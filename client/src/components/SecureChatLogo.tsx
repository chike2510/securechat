import React from "react";

const SECURECHAT_LOGO_SRC = "/manus-storage/securechat-logo-unique-concept_5fdea1ba.png";

export function SecureChatLogo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return <img src={SECURECHAT_LOGO_SRC} alt="SecureChat" width={size} height={size} className={`object-contain ${className}`} />;
}
