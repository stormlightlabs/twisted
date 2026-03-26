package index

import "fmt"

type PermanentError struct {
	Decision string
	Err      error
}

func (e *PermanentError) Error() string {
	if e.Err == nil {
		return e.Decision
	}
	return fmt.Sprintf("%s: %v", e.Decision, e.Err)
}

func (e *PermanentError) Unwrap() error {
	return e.Err
}

func IsPermanent(err error) (*PermanentError, bool) {
	perr, ok := err.(*PermanentError)
	return perr, ok
}
