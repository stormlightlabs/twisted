# Twisted icon generator

This package turns Twisted's square source mark into the fixed PNG assets used
by browsers and installed web apps. The recipes keep output deterministic and
give maskable icons enough room for launcher cropping.

Run the generator from the repository root:

```sh
bun run icons:generate
```

By default, it reads `packages/app/public/favicon.png` and writes these files to
`packages/app/public/icons/`:

- 192px and 512px standard PWA icons
- 192px and 512px maskable PWA icons
- a 180px Apple touch icon

Pass a different square PNG as the first argument. Use `--output` to choose an
output directory or `--background` to replace the default `#212337` canvas:

```sh
bun run icons:generate -- ./mark.png --output ./public/icons --background '#212337'
```

Every output is an opaque PNG. The command validates its dimensions before it
finishes.
