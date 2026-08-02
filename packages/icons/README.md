# Twisted icon generator

This package turns Twisted's monochrome source mark into the fixed assets used
by the app shell, browsers, and installed web apps. It creates light and dark
SVG logos as well as deterministic PNG icons with enough room for launcher
cropping.

Run the generator from the repository root:

```sh
bun run icons:generate
```

By default, it reads `packages/app/public/base.svg` and writes these files to
`packages/app/public/icons/`:

- light and dark SVG logos for the app shell
- 192px and 512px standard PWA icons
- 192px and 512px maskable PWA icons
- a 180px Apple touch icon

Pass a different square SVG that uses `currentColor` as the first argument. Use
`--output` to choose an output directory. `--background` and `--foreground`
replace the default PWA icon colors:

```sh
bun run icons:generate -- ./mark.svg --output ./public/icons --background '#212337' --foreground '#ebfafa'
```

Every output is an opaque PNG. The command validates its dimensions before it
finishes. The app references the generated files from `manifest.webmanifest`
and uses the Apple touch icon from `index.html`.
