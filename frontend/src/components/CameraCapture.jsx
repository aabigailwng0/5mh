import React, { useCallback, useRef, useState } from "react";
import Webcam from "react-webcam";
import { Camera, RefreshCw, Upload } from "lucide-react";

// Captures one face photo per day. Adapted from dermafyr's react-webcam pattern
// but simplified: no auth, no router — it just hands a Blob to the parent.
const videoConstraints = { width: 640, height: 640, facingMode: "user" };

function dataURLtoBlob(dataUrl) {
  const [header, body] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)[1];
  const bytes = atob(body);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export default function CameraCapture({ onPhoto, preview }) {
  const webcamRef = useRef(null);
  const fileRef = useRef(null);
  const [useUpload, setUseUpload] = useState(false);
  const [dragging, setDragging] = useState(false);

  const capture = useCallback(() => {
    const shot = webcamRef.current?.getScreenshot();
    if (shot) onPhoto(dataURLtoBlob(shot), shot);
  }, [onPhoto]);

  // Accept a File from either the picker or a drag-and-drop, validating it's an
  // image before handing the Blob (and a preview URL) to the parent.
  const acceptFile = useCallback(
    (file) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) return;
      onPhoto(file, URL.createObjectURL(file));
    },
    [onPhoto]
  );

  const onFile = (e) => {
    acceptFile(e.target.files?.[0]);
    // Reset so selecting the same file again still fires onChange.
    e.target.value = "";
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    acceptFile(e.dataTransfer.files?.[0]);
  };

  const openPicker = () => fileRef.current?.click();

  return (
    <div className="flex flex-col items-center gap-6">
      {/* File input is always mounted so the ref is stable regardless of mode. */}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />

      <div className="polaroid relative rotate-[-2deg]">
        <span className="tape" style={{ top: -10, left: "50%", marginLeft: -40 }} />
        <div className="relative h-[272px] w-[272px] overflow-hidden bg-ink/5">
          {preview ? (
            <img src={preview} alt="Captured face" className="h-full w-full object-cover" />
          ) : useUpload ? (
            <button
              type="button"
              onClick={openPicker}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 text-ink/55 transition-colors ${
                dragging ? "bg-purple-100 text-purple-700" : "hover:bg-ink/5"
              }`}
            >
              <Upload className="h-9 w-9" strokeWidth={1.25} />
              <span className="text-caption uppercase tracking-wide">
                {dragging ? "Drop to upload" : "Click or drop a photo"}
              </span>
            </button>
          ) : (
            <Webcam
              ref={webcamRef}
              audio={false}
              mirrored
              screenshotFormat="image/jpeg"
              videoConstraints={videoConstraints}
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <span className="polaroid-caption">
          {preview ? "today \u00b7 your face" : useUpload ? "upload a photo" : "live \u00b7 smile"}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {preview ? (
          <button onClick={() => onPhoto(null, null)} className="btn-ghost">
            <RefreshCw className="h-4 w-4" /> RETAKE
          </button>
        ) : useUpload ? (
          <button onClick={openPicker} className="btn-primary">
            <Upload className="h-4 w-4" /> UPLOAD PHOTO
          </button>
        ) : (
          <button onClick={capture} className="btn-primary">
            <Camera className="h-4 w-4" /> TAKE PHOTO
          </button>
        )}
        <button onClick={() => setUseUpload((v) => !v)} className="btn-flat">
          {useUpload ? "use webcam" : "upload instead"}
        </button>
      </div>
    </div>
  );
}
