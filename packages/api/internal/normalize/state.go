package normalize

import "fmt"

const (
	collectionIssueState string = "sh.tangled.repo.issue.state"
	collectionPullStatus string = "sh.tangled.repo.pull.status"
)

// IssueStateHandler processes sh.tangled.repo.issue.state records.
type IssueStateHandler struct{}

func (h *IssueStateHandler) Collection() string { return collectionIssueState }

func (h *IssueStateHandler) HandleState(event TapRecordEvent) (*StateUpdate, error) {
	r := event.Record
	rec := r.Record

	subject := str(rec, "subject")
	if subject == "" {
		return nil, fmt.Errorf("issue state record missing subject field")
	}
	state := str(rec, "status")
	if state == "" {
		return nil, fmt.Errorf("issue state record missing status field")
	}

	return &StateUpdate{
		SubjectURI: subject,
		State:      state,
	}, nil
}

// PullStatusHandler processes sh.tangled.repo.pull.status records.
type PullStatusHandler struct{}

func (h *PullStatusHandler) Collection() string { return collectionPullStatus }

func (h *PullStatusHandler) HandleState(event TapRecordEvent) (*StateUpdate, error) {
	r := event.Record
	rec := r.Record

	subject := str(rec, "subject")
	if subject == "" {
		return nil, fmt.Errorf("pull status record missing subject field")
	}
	status := str(rec, "status")
	if status == "" {
		return nil, fmt.Errorf("pull status record missing status field")
	}

	return &StateUpdate{
		SubjectURI: subject,
		State:      status,
	}, nil
}
