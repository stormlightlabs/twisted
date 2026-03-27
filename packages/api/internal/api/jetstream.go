package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"time"

	"github.com/coder/websocket"
	"tangled.org/desertthunder.dev/twister/internal/store"
)

const (
	jetstreamConsumerName   = "jetstream-cache-v1"
	jetstreamReconnectDelay = 5 * time.Second
	jetstreamMaxReadBytes   = 8 << 20
	// persist cursor every N events
	jetstreamCursorInterval = 50
)

type jetstreamMessage struct {
	DID    string `json:"did"`
	TimeUS int64  `json:"time_us"`
	Kind   string `json:"kind"`
	Commit *struct {
		Operation  string `json:"operation"`
		Collection string `json:"collection"`
		RKey       string `json:"rkey"`
	} `json:"commit"`
}

// runJetstreamConsumer connects to JetStream and caches sh.tangled.* events.
// Reconnects automatically after any disconnect.
func (s *Server) runJetstreamConsumer(ctx context.Context) {
	s.log.Info("jetstream cache consumer starting")
	for {
		if ctx.Err() != nil {
			s.log.Info("jetstream cache consumer stopped")
			return
		}
		if err := s.consumeJetstream(ctx); err != nil && ctx.Err() == nil {
			s.log.Warn("jetstream consumer disconnected; reconnecting",
				slog.String("error", err.Error()),
				slog.Duration("retry_in", jetstreamReconnectDelay),
			)
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(jetstreamReconnectDelay):
		}
	}
}

func (s *Server) consumeJetstream(ctx context.Context) error {
	cursorUS, err := s.loadJetstreamCursor(ctx)
	if err != nil {
		return fmt.Errorf("load jetstream cursor: %w", err)
	}

	u := buildJetstreamURL(s.cfg.JetstreamURL, s.cfg.JetstreamWantedCollections, cursorUS)
	conn, _, err := websocket.Dial(ctx, u, nil)
	if err != nil {
		return fmt.Errorf("jetstream dial: %w", err)
	}
	defer conn.CloseNow()
	conn.SetReadLimit(jetstreamMaxReadBytes)

	s.log.Info("jetstream consumer connected", slog.Int64("cursor_us", cursorUS))

	var count int64
	var lastTimeUS int64 = cursorUS

	for {
		if ctx.Err() != nil {
			return nil
		}

		_, msg, err := conn.Read(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return nil
			}
			return fmt.Errorf("jetstream read: %w", err)
		}

		var jmsg jetstreamMessage
		if err := json.Unmarshal(msg, &jmsg); err != nil {
			s.log.Debug("jetstream parse failed", slog.String("error", err.Error()))
			continue
		}
		if jmsg.DID == "" || jmsg.TimeUS == 0 {
			continue
		}

		evt := &store.JetstreamEvent{
			TimeUS:     jmsg.TimeUS,
			DID:        jmsg.DID,
			Kind:       jmsg.Kind,
			Payload:    string(msg),
			ReceivedAt: time.Now().UTC().Format(time.RFC3339),
		}
		if jmsg.Commit != nil {
			evt.Collection = jmsg.Commit.Collection
			evt.RKey = jmsg.Commit.RKey
			evt.Operation = jmsg.Commit.Operation
		}

		if err := s.store.InsertJetstreamEvent(ctx, evt, s.cfg.ActivityMaxEvents); err != nil {
			s.log.Warn("jetstream insert failed", slog.String("error", err.Error()))
		}

		lastTimeUS = jmsg.TimeUS
		count++

		if count%jetstreamCursorInterval == 0 {
			cursor := strconv.FormatInt(lastTimeUS, 10)
			if err := s.store.SetSyncState(ctx, jetstreamConsumerName, cursor); err != nil {
				s.log.Warn("jetstream cursor persist failed", slog.String("error", err.Error()))
			}
		}
	}
}

// loadJetstreamCursor returns the cursor to use when connecting to JetStream.
// First boot: seeds to now-24h. Subsequent connects: rewinds by ActivityRewindDuration.
func (s *Server) loadJetstreamCursor(ctx context.Context) (int64, error) {
	state, err := s.store.GetSyncState(ctx, jetstreamConsumerName)
	if err != nil {
		return 0, err
	}

	if state == nil || strings.TrimSpace(state.Cursor) == "" {
		seed := time.Now().UTC().Add(-24 * time.Hour).UnixMicro()
		s.log.Info("jetstream cursor: first boot, seeding to now-24h", slog.Int64("cursor_us", seed))
		return seed, nil
	}

	cursor, err := strconv.ParseInt(strings.TrimSpace(state.Cursor), 10, 64)
	if err != nil {
		seed := time.Now().UTC().Add(-24 * time.Hour).UnixMicro()
		s.log.Warn("jetstream cursor parse failed; reseeding to now-24h",
			slog.String("raw", state.Cursor), slog.String("error", err.Error()))
		return seed, nil
	}

	rewound := cursor - s.cfg.ActivityRewindDuration.Microseconds()
	s.log.Info("jetstream cursor: rewinding on reconnect",
		slog.Int64("prev_us", cursor),
		slog.Duration("rewind", s.cfg.ActivityRewindDuration),
		slog.Int64("cursor_us", rewound),
	)
	return rewound, nil
}

// buildJetstreamURL constructs the JetStream subscribe URL with wanted collections
// and cursor. The wildcard character in collection names is not percent-encoded.
func buildJetstreamURL(base, collections string, cursorUS int64) string {
	var parts []string
	for _, c := range strings.Split(collections, ",") {
		c = strings.TrimSpace(c)
		if c != "" {
			parts = append(parts, "wantedCollections="+c)
		}
	}
	if cursorUS > 0 {
		parts = append(parts, "cursor="+strconv.FormatInt(cursorUS, 10))
	}
	if len(parts) == 0 {
		return base
	}
	return base + "?" + strings.Join(parts, "&")
}
