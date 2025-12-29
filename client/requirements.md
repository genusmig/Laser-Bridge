## Packages
recharts | For visualizing G-code paths or speed graphs
clsx | For conditional class merging
tailwind-merge | For handling Tailwind class conflicts

## Notes
- Server opens a direct serial connection to the GRBL device (configured via `SERIAL_DEVICE` and `SERIAL_BAUD`) and serves a WebSocket at `/ws` for the UI; this removes dependence on an external LightBurn TCP bridge or status WS.
- Uses 'JetBrains Mono' for technical data display
- Industrial dark theme implemented via CSS variables
- Dashboard layout is optimized for desktop control
