package backfill

import (
	"context"

	"tangled.org/desertthunder.dev/twister/internal/xrpc"
)

type handleResolver interface {
	Resolve(ctx context.Context, handle string) (string, error)
}

// XRPCHandleResolver resolves handles through the xrpc.Client.
type XRPCHandleResolver struct {
	client *xrpc.Client
}

func NewXRPCHandleResolver(client *xrpc.Client) *XRPCHandleResolver {
	return &XRPCHandleResolver{client: client}
}

func (r *XRPCHandleResolver) Resolve(ctx context.Context, handle string) (string, error) {
	return r.client.ResolveHandle(ctx, handle)
}
