import React from "react";
import { logo } from "@/lib/brandAssets";

const SECURECHAT_LOGO_SRC = logo;

export function SecureChatLogo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return <img src={SECURECHAT_LOGO_SRC} alt="SecureChat" width={size} height={size} className={`object-contain ${className}`} />;
}
