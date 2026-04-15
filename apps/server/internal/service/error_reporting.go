package service

import "context"

type ErrorReporter interface {
	Capture(context.Context, ErrorEvent)
}

type ErrorEvent struct {
	Source   string            `json:"source"`
	Category string            `json:"category"`
	Message  string            `json:"message"`
	Stack    string            `json:"stack,omitempty"`
	Tags     map[string]string `json:"tags,omitempty"`
	Fields   map[string]any    `json:"fields,omitempty"`
}

type noopErrorReporter struct{}

func (noopErrorReporter) Capture(context.Context, ErrorEvent) {}

func (s *Service) SetErrorReporter(reporter ErrorReporter) {
	if reporter == nil {
		s.reporter = noopErrorReporter{}
		return
	}

	s.reporter = reporter
}

func (s *Service) ReportError(ctx context.Context, event ErrorEvent) {
	if s.reporter == nil {
		s.reporter = noopErrorReporter{}
	}

	s.reporter.Capture(ctx, event)
}
