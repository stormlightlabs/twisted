package tapclient

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"math/rand/v2"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/coder/websocket"
	"tangled.org/desertthunder.dev/twister/internal/normalize"
)

const (
	minReconnectBackoff = 500 * time.Millisecond
	maxReconnectBackoff = 10 * time.Second
)

// Client receives Tap events over WebSocket and sends acks after processing.
type Client struct {
	url      string
	password string
	log      *slog.Logger

	mu        sync.Mutex
	conn      *websocket.Conn
	ackAsJSON bool
}

func New(url, password string, log *slog.Logger) *Client {
	if log == nil {
		log = slog.Default()
	}
	return &Client{
		url:       url,
		password:  password,
		log:       log,
		ackAsJSON: true,
	}
}

func (c *Client) ReadEvent(ctx context.Context) (normalize.TapRecordEvent, error) {
	for {
		conn, err := c.ensureConnected(ctx)
		if err != nil {
			return normalize.TapRecordEvent{}, err
		}

		_, data, err := conn.Read(ctx)
		if err != nil {
			c.log.Warn("tap read failed", slog.String("error", err.Error()))
			c.resetConn(websocket.StatusInternalError, "read failed")
			if ctx.Err() != nil {
				return normalize.TapRecordEvent{}, ctx.Err()
			}
			continue
		}

		var event normalize.TapRecordEvent
		if err := json.Unmarshal(data, &event); err != nil {
			c.log.Warn("tap decode failed", slog.String("error", err.Error()))
			continue
		}

		return event, nil
	}
}

func (c *Client) AckEvent(ctx context.Context, id int64) error {
	conn, err := c.ensureConnected(ctx)
	if err != nil {
		return err
	}

	c.mu.Lock()
	ackAsJSON := c.ackAsJSON
	c.mu.Unlock()

	if ackAsJSON {
		payload, _ := json.Marshal(map[string]int64{"id": id})
		if err := conn.Write(ctx, websocket.MessageText, payload); err == nil {
			return nil
		}

		c.log.Warn("tap ack json failed; trying plain id", slog.Int64("event_id", id))
		plain := []byte(strconv.FormatInt(id, 10))
		if err := conn.Write(ctx, websocket.MessageText, plain); err != nil {
			c.resetConn(websocket.StatusInternalError, "ack failed")
			return fmt.Errorf("ack event %d: %w", id, err)
		}

		c.mu.Lock()
		c.ackAsJSON = false
		c.mu.Unlock()
		return nil
	}

	if err := conn.Write(ctx, websocket.MessageText, []byte(strconv.FormatInt(id, 10))); err != nil {
		c.resetConn(websocket.StatusInternalError, "ack failed")
		return fmt.Errorf("ack event %d: %w", id, err)
	}
	return nil
}

func (c *Client) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.conn == nil {
		return nil
	}
	err := c.conn.Close(websocket.StatusNormalClosure, "shutdown")
	c.conn = nil
	return err
}

func (c *Client) ensureConnected(ctx context.Context) (*websocket.Conn, error) {
	c.mu.Lock()
	if c.conn != nil {
		conn := c.conn
		c.mu.Unlock()
		return conn, nil
	}
	c.mu.Unlock()

	backoff := minReconnectBackoff
	for {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}

		h := http.Header{}
		if c.password != "" {
			token := base64.StdEncoding.EncodeToString([]byte("admin:" + c.password))
			h.Set("Authorization", "Basic "+token)
		}

		conn, _, err := websocket.Dial(ctx, c.url, &websocket.DialOptions{HTTPHeader: h})
		if err == nil {
			c.mu.Lock()
			if c.conn == nil {
				c.conn = conn
			} else {
				_ = conn.Close(websocket.StatusNormalClosure, "duplicate")
			}
			existing := c.conn
			c.mu.Unlock()
			c.log.Info("tap connected")
			return existing, nil
		}

		c.log.Warn("tap connect failed", slog.String("error", err.Error()), slog.Duration("retry_in", backoff))

		jitter := time.Duration(rand.Int64N(int64(backoff / 2)))
		wait := backoff + jitter
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(wait):
		}

		backoff *= 2
		if backoff > maxReconnectBackoff {
			backoff = maxReconnectBackoff
		}
	}
}

func (c *Client) resetConn(status websocket.StatusCode, reason string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.conn == nil {
		return
	}
	_ = c.conn.Close(status, reason)
	c.conn = nil
}
