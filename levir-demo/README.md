# LEVIRDet Demo Website

This is a local demo website for LEVIRDet detection visualization. It contains
local copies of the demo images and wrapped COCO-format prediction files:

- `./imgs/`
- `./demo-data.js`
- `./fine-imgs/`
- `./fine-data.js`
- `./uwd-imgs/`
- `./uwd-data.js`

## Local preview

Run the server from `F:\web`:

```powershell
python -m http.server 5173 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:5173/levir-demo/
```

The demo can also be opened directly as `index.html` because the prediction data
is loaded through a local JavaScript file.

Use the carousel `>` button to switch from Object Detection to Fine-grained
Object Detection. In fine-grained mode, hovering over a box highlights all
detections with the same fine label and shows a Tree / Graph hierarchy panel.

Use the carousel `<` button from Object Detection to switch to Ultra-Wide Area
Object Detection. This mode uses resized JPEG assets to keep the public demo
lightweight while preserving COCO box alignment through percentage coordinates.
