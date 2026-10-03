# Ms Robot brand derivatives

Use the approved user-supplied `MSRobot.zip` as the source. The registry records every source hash and production derivative. Raw boards, alternate brand systems, marketing sample measurements and duplicate archive images are not public application assets.

Rebuild with Python 3 and Pillow installed:

```sh
python3 scripts/brand/build_assets.py /absolute/path/MSRobot.zip
```

Review the resulting `docs/brand/asset-registry.json` and `public/brand/ms-robot` together. Pillow/WebP encoder versions can affect compressed bytes; verify the regenerated registry hashes against the produced files rather than assuming cross-version byte identity. The source archive SHA-256 must match the reviewed kit.

The build produces PNG/WebP icons at 32, 48, 96, 192 and 512px; WebP avatars at 32, 48, 64, 96, 128 and 256px; 192/384px signatures; and 96/192px crops for twelve states. The simplified existing SVG remains the tiny favicon. State crops exclude captions and are decorative; operational state remains explicit in normal text and controls.

Mobile tables and analytics retain priority over artwork. Marketing/sticker/alternative sheets remain reference material. Do not derive real metrics from a mockup. No new replacement artwork was generated.
