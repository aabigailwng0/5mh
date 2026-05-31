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

  const capture = useCallback(() => {
    const shot = webcamRef.current?.getScreenshot();
    if (shot) onPhoto(dataURLtoBlob(shot), shot);
  }, [onPhoto]);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onPhoto(file, url);
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative h-[300px] w-[300px] overflow-hidden rounded-card border border-purple-400 bg-white">
        {preview ? (
          <img src={preview} alt="Captured face" className="h-full w-full object-cover" />
        ) : useUpload ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-black/60">
            <Upload className="h-9 w-9" />
            <span className="text-caption uppercase tracking-wide">Choose a photo</span>
          </div>
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

      <div className="flex items-center gap-4">
        {preview ? (
          <button onClick={() => onPhoto(null, null)} className="btn-ghost">
            <RefreshCw className="h-4 w-4" /> RETAKE
          </button>
        ) : useUpload ? (
          <>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
            <button onClick={() => fileRef.current?.click()} className="btn-primary">
              <Upload className="h-4 w-4" /> UPLOAD PHOTO
            </button>
          </>
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
