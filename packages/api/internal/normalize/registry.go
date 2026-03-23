package normalize

// Registry maps collection NSIDs to their adapters or state handlers.
type Registry struct {
	adapters      map[string]RecordAdapter
	stateHandlers map[string]StateHandler
}

// NewRegistry returns a Registry pre-loaded with all supported adapters.
func NewRegistry() *Registry {
	r := &Registry{
		adapters:      make(map[string]RecordAdapter),
		stateHandlers: make(map[string]StateHandler),
	}
	for _, a := range []RecordAdapter{
		&RepoAdapter{},
		&IssueAdapter{},
		&PullAdapter{},
		&IssueCommentAdapter{},
		&PullCommentAdapter{},
		&StringAdapter{},
		&FollowAdapter{},
		&ProfileAdapter{},
	} {
		r.adapters[a.Collection()] = a
	}
	for _, h := range []StateHandler{
		&IssueStateHandler{},
		&PullStatusHandler{},
	} {
		r.stateHandlers[h.Collection()] = h
	}
	return r
}

// Adapter returns the RecordAdapter for a collection, if supported.
func (r *Registry) Adapter(collection string) (RecordAdapter, bool) {
	a, ok := r.adapters[collection]
	return a, ok
}

// StateHandler returns the StateHandler for a collection, if supported.
func (r *Registry) StateHandler(collection string) (StateHandler, bool) {
	h, ok := r.stateHandlers[collection]
	return h, ok
}
