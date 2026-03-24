package xrpc

import (
	"sync"
	"time"
)

type cacheEntry[T any] struct {
	value     T
	expiresAt time.Time
}

type ttlCache[T any] struct {
	mu      sync.RWMutex
	entries map[string]cacheEntry[T]
	ttl     time.Duration
}

func newTTLCache[T any](ttl time.Duration) *ttlCache[T] {
	return &ttlCache[T]{
		entries: make(map[string]cacheEntry[T]),
		ttl:     ttl,
	}
}

func (c *ttlCache[T]) Get(key string) (T, bool) {
	c.mu.RLock()
	entry, ok := c.entries[key]
	c.mu.RUnlock()
	if !ok {
		var zero T
		return zero, false
	}
	if time.Now().After(entry.expiresAt) {
		c.mu.Lock()
		delete(c.entries, key)
		c.mu.Unlock()
		var zero T
		return zero, false
	}
	return entry.value, true
}

func (c *ttlCache[T]) Set(key string, value T) {
	c.mu.Lock()
	c.entries[key] = cacheEntry[T]{
		value:     value,
		expiresAt: time.Now().Add(c.ttl),
	}
	c.mu.Unlock()
}

func (c *ttlCache[T]) Invalidate(key string) {
	c.mu.Lock()
	delete(c.entries, key)
	c.mu.Unlock()
}
