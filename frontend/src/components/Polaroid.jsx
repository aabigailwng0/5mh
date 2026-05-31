import React from "react";

// A photo dressed as a collage polaroid: paper frame, a typewritten caption,
// a slight tilt, and (optionally) a strip of washi tape pinning it down.
// Purely presentational — the same image data renders, just framed.
export default function Polaroid({
  src,
  alt = "",
  caption,
  rotate = -2,
  tape = false,
  className = "",
  style,
  children,
}) {
  return (
    <div
      className={`polaroid ${className}`}
      style={{ transform: `rotate(${rotate}deg)`, ...style }}
    >
      {tape && (
        <span className="tape" style={{ top: -10, left: "50%", marginLeft: -40 }} />
      )}
      {src ? (
        <img src={src} alt={alt} className="polaroid-photo" />
      ) : (
        <div className="polaroid-photo">{children}</div>
      )}
      {caption && <span className="polaroid-caption">{caption}</span>}
    </div>
  );
}
