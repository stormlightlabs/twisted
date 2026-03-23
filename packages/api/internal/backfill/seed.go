package backfill

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

type seedEntry struct {
	raw    string
	isDID  bool
	lineNo int
}

func parseSeedFile(path string) ([]seedEntry, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open seed file: %w", err)
	}
	defer f.Close()

	seen := map[string]bool{}
	entries := make([]seedEntry, 0)
	s := bufio.NewScanner(f)
	lineNo := 0
	for s.Scan() {
		lineNo++
		line := strings.TrimSpace(s.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if seen[line] {
			continue
		}
		seen[line] = true
		entries = append(entries, seedEntry{
			raw:    line,
			isDID:  isDID(line),
			lineNo: lineNo,
		})
	}
	if err := s.Err(); err != nil {
		return nil, fmt.Errorf("scan seed file: %w", err)
	}
	if len(entries) == 0 {
		return nil, fmt.Errorf("seed file has no valid entries")
	}
	return entries, nil
}

func parseSeedInput(input string) ([]seedEntry, error) {
	input = strings.TrimSpace(input)
	if input == "" {
		return nil, fmt.Errorf("seeds input is required")
	}

	if strings.Contains(input, ",") {
		return parseSeedList(input)
	}

	info, err := os.Stat(input)
	if err == nil && !info.IsDir() {
		return parseSeedFile(input)
	}

	// Single inline DID/handle is supported for convenience.
	return parseSeedList(input)
}

func parseSeedList(list string) ([]seedEntry, error) {
	parts := strings.Split(list, ",")
	seen := map[string]bool{}
	entries := make([]seedEntry, 0, len(parts))
	for i, part := range parts {
		value := strings.TrimSpace(part)
		if value == "" {
			continue
		}
		if seen[value] {
			continue
		}
		seen[value] = true
		entries = append(entries, seedEntry{
			raw:    value,
			isDID:  isDID(value),
			lineNo: i + 1,
		})
	}
	if len(entries) == 0 {
		return nil, fmt.Errorf("seed list has no valid entries")
	}
	return entries, nil
}

func isDID(v string) bool {
	return strings.HasPrefix(v, "did:")
}
