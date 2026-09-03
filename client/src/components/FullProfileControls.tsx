import React, { ChangeEvent, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  createDeviceLinkKeyPair,
  decryptIdentityFromDevice,
  encryptIdentityForDevice,
  ensureIdentity,
  exportEncryptedRecoveryBundle,
  importEncryptedRecoveryBundle,
  type DeviceLinkBundle,
} from "@/lib/crypto";
import { Button } from "@/components/ui/button";
import {
  avatarBucketHat,
  avatarHeadphones,
  avatarSmile,
  avatarYellowHoodie,
} from "@/lib/brandAssets";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  Check,
  Download,
  ImagePlus,
  Link2,
  LockKeyhole,
  QrCode,
  ScanLine,
  Settings2,
  ShieldBan,
  Upload,
  UserRoundCheck,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";

type Style = "ink" | "mint" | "rose" | "violet";
type ChatUser = {
  id: number;
  name?: string | null;
  username?: string | null;
  email?: string | null;
  matricNumber?: string | null;
};
const illustratedAvatars: Record<Style, string> = {
  mint: avatarSmile,
  violet: avatarHeadphones,
  rose: avatarBucketHat,
  ink: avatarYellowHoodie,
};
function Avatar({
  name,
  style = "mint",
  image,
  large = false,
}: {
  name?: string | null;
  style?: Style;
  image?: string | null;
  large?: boolean;
}) {
  const dimensions = large ? "h-24 w-24 text-2xl" : "h-8 w-8 text-xs";
  return (
    <img
      src={image || illustratedAvatars[style]}
      alt="Profile"
      className={`${dimensions} rounded-2xl object-cover border border-slate-900/10`}
    />
  );
}

export function ProfileControls({
  user,
  onSignOut,
}: {
  user: ChatUser;
  onSignOut: () => Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false),
    [profileOpen, setProfileOpen] = useState(false),
    [requestsOpen, setRequestsOpen] = useState(false);
  const [name, setName] = useState(user.name ?? ""),
    [username, setUsername] = useState(user.username ?? ""),
    [style, setStyle] = useState<Style>("mint"),
    [imageData, setImageData] = useState<string | null>(null),
    [imageType, setImageType] = useState<
      "image/jpeg" | "image/png" | "image/webp" | null
    >(null),
    [removeImage, setRemoveImage] = useState(false);
  const imageInput = useRef<HTMLInputElement | null>(null);
  const recoveryInput = useRef<HTMLInputElement | null>(null);
  const [recoveryPassphrase, setRecoveryPassphrase] = useState("");
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState<"idle" | "link" | "recover">(
    "idle"
  );
  const [deviceLinkId, setDeviceLinkId] = useState<string | null>(null);
  const [deviceLinkKeys, setDeviceLinkKeys] = useState<{
    publicKey: JsonWebKey;
    privateKey: JsonWebKey;
  } | null>(null);
  const [deviceLinkMessage, setDeviceLinkMessage] = useState(
    "Scan this code on your new device"
  );
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const qrCanvas = useRef<HTMLCanvasElement | null>(null);
  const scannerVideo = useRef<HTMLVideoElement | null>(null);
  const scannerStream = useRef<MediaStream | null>(null);
  const scanFrame = useRef<number | null>(null);
  const sentLinkRef = useRef<string | null>(null);
  const consumedLinkRef = useRef<string | null>(null);
  const [fileFallbackOpen, setFileFallbackOpen] = useState(false);
  const deviceLinkMutation =
    trpc.secureChat.createDeviceLinkSession.useMutation();
  const deviceLinkStatus = trpc.secureChat.getDeviceLinkSession.useQuery(
    { sessionId: deviceLinkId ?? "00000000-0000-0000-0000-000000000000" },
    { enabled: Boolean(deviceLinkId), refetchInterval: 1000 }
  );
  const claimDeviceLink = trpc.secureChat.claimDeviceLinkSession.useMutation();
  const completeDeviceLink =
    trpc.secureChat.completeDeviceLinkSession.useMutation();
  const consumeDeviceLink =
    trpc.secureChat.consumeDeviceLinkSession.useMutation();
  const settings = trpc.secureChat.profileSettings.useQuery();
  const requests = trpc.secureChat.messageRequests.useQuery(undefined, {
    enabled: requestsOpen,
  });
  const blocked = trpc.secureChat.blockedUsers.useQuery(undefined, {
    enabled: profileOpen,
  });
  const updateProfile = trpc.secureChat.updateProfile.useMutation({
    onSuccess: () => {
      setImageData(null);
      setRemoveImage(false);
      void settings.refetch();
      toast.success("Profile saved");
    },
  });
  const updatePrivacy = trpc.secureChat.updatePrivacy.useMutation({
    onSuccess: () => void settings.refetch(),
  });
  const respond = trpc.secureChat.respondToMessageRequest.useMutation({
    onSuccess: () => void requests.refetch(),
  });
  const unblock = trpc.secureChat.unblockUser.useMutation({
    onSuccess: () => void blocked.refetch(),
  });
  useEffect(() => {
    if (settings.data) {
      setName(settings.data.name ?? "");
      setUsername(settings.data.username ?? "");
      setStyle(settings.data.avatarStyle ?? "mint");
    }
  }, [settings.data]);
  const currentImage = removeImage
    ? null
    : imageData
      ? `data:${imageType};base64,${imageData}`
      : settings.data?.profileImageUrl;
  const chooseImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (
      !(["image/jpeg", "image/png", "image/webp"] as string[]).includes(
        file.type
      )
    )
      return toast.error("Use a JPG, PNG, or WebP image");
    if (file.size > 512 * 1024)
      return toast.error("Profile picture must be 512 KB or smaller");
    const reader = new FileReader();
    reader.onload = () => {
      const value =
        typeof reader.result === "string" ? reader.result.split(",")[1] : null;
      if (value) {
        setImageData(value);
        setImageType(file.type as NonNullable<typeof imageType>);
        setRemoveImage(false);
      }
    };
    reader.readAsDataURL(file);
  };
  const save = () => {
    if (name.trim().length < 2) return toast.error("Enter a display name");
    if (!/^[a-zA-Z0-9_.]{3,24}$/.test(username.trim()))
      return toast.error(
        "Use 3–24 letters, numbers, dots, or underscores for your username"
      );
    updateProfile.mutate({
      name,
      username: username.trim(),
      avatarStyle: style,
      imageData,
      imageType,
      clearImage: removeImage,
    });
  };
  const exportRecovery = async () => {
    setRecoveryBusy(true);
    try {
      const bundle = await exportEncryptedRecoveryBundle(recoveryPassphrase);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(
        new Blob([bundle], { type: "application/json" })
      );
      link.download = "securechat-recovery.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      toast.success("Recovery file downloaded");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not create recovery file"
      );
    } finally {
      setRecoveryBusy(false);
    }
  };
  const importRecovery = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setRecoveryBusy(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await importEncryptedRecoveryBundle(
          String(reader.result ?? ""),
          recoveryPassphrase
        );
        await ensureIdentity();
        toast.success("This device is ready to open your encrypted chats");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not restore this device"
        );
      } finally {
        setRecoveryBusy(false);
      }
    };
    reader.readAsText(file);
  };
  const stopScanner = () => {
    if (scanFrame.current !== null) cancelAnimationFrame(scanFrame.current);
    scanFrame.current = null;
    scannerStream.current?.getTracks().forEach(track => track.stop());
    scannerStream.current = null;
    if (scannerVideo.current) scannerVideo.current.srcObject = null;
  };
  const startLink = async () => {
    setRecoveryBusy(true);
    try {
      const keys = await createDeviceLinkKeyPair();
      const session = await deviceLinkMutation.mutateAsync({
        ownerPublicKey: JSON.stringify(keys.publicKey),
      });
      setDeviceLinkKeys(keys);
      setDeviceLinkId(session.sessionId);
      setRecoveryMode("link");
      setDeviceLinkMessage("Scan this code on your new device");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not create a device link"
      );
    } finally {
      setRecoveryBusy(false);
    }
  };
  const decodeQrValue = (value: string) => {
    try {
      const payload = JSON.parse(value) as {
        version: number;
        sessionId: string;
        ownerPublicKey: string;
      };
      if (
        payload.version !== 1 ||
        !payload.sessionId ||
        !payload.ownerPublicKey
      )
        throw new Error("Invalid QR code");
      return payload;
    } catch {
      throw new Error("That QR code is not a SecureChat device link");
    }
  };
  const handleQrValue = async (value: string) => {
    stopScanner();
    setScannerOpen(false);
    setRecoveryBusy(true);
    try {
      const payload = decodeQrValue(value);
      const keys = await createDeviceLinkKeyPair();
      await claimDeviceLink.mutateAsync({
        sessionId: payload.sessionId,
        recipientPublicKey: JSON.stringify(keys.publicKey),
      });
      setDeviceLinkId(payload.sessionId);
      setDeviceLinkKeys(keys);
      setRecoveryMode("recover");
      setDeviceLinkMessage(
        "Waiting for the linked device to send your encrypted identity"
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not read this device link"
      );
    } finally {
      setRecoveryBusy(false);
    }
  };
  const startScanner = async () => {
    setCameraError(null);
    setScannerOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      scannerStream.current = stream;
      if (!scannerVideo.current) return;
      scannerVideo.current.srcObject = stream;
      await scannerVideo.current.play();
      const Detector = (
        window as Window & {
          BarcodeDetector?: new (options?: { formats?: string[] }) => {
            detect: (
              source: HTMLVideoElement
            ) => Promise<Array<{ rawValue?: string }>>;
          };
        }
      ).BarcodeDetector;
      if (!Detector) {
        setCameraError(
          "QR scanning is not supported in this browser. Use the recovery file instead."
        );
        return;
      }
      const detector = new Detector({ formats: ["qr_code"] });
      const scan = async () => {
        if (!scannerVideo.current || scannerVideo.current.readyState < 2) {
          scanFrame.current = requestAnimationFrame(() => void scan());
          return;
        }
        const results = await detector.detect(scannerVideo.current);
        const value = results[0]?.rawValue;
        if (value) {
          await handleQrValue(value);
          return;
        }
        scanFrame.current = requestAnimationFrame(() => void scan());
      };
      scanFrame.current = requestAnimationFrame(() => void scan());
    } catch {
      setCameraError(
        "Camera access is unavailable. Use the recovery file instead."
      );
    }
  };
  const copyQrPayload = async () => {
    if (!deviceLinkId || !deviceLinkKeys) return;
    const payload = JSON.stringify({
      version: 1,
      sessionId: deviceLinkId,
      ownerPublicKey: JSON.stringify(deviceLinkKeys.publicKey),
    });
    await navigator.clipboard?.writeText(payload);
    toast.success("Device-link code copied");
  };
  useEffect(() => () => stopScanner(), []);
  useEffect(() => {
    if (
      recoveryMode !== "link" ||
      !deviceLinkStatus.data ||
      deviceLinkStatus.data.status !== "claimed" ||
      !deviceLinkStatus.data.recipientPublicKey ||
      !deviceLinkId ||
      sentLinkRef.current === deviceLinkId
    )
      return;
    sentLinkRef.current = deviceLinkId;
    void (async () => {
      try {
        const bundle = await encryptIdentityForDevice(
          JSON.parse(deviceLinkStatus.data.recipientPublicKey!),
          deviceLinkKeys ?? undefined
        );
        await completeDeviceLink.mutateAsync({
          sessionId: deviceLinkId,
          bundle,
        });
        setDeviceLinkMessage(
          "Identity sent securely. You can close this window."
        );
      } catch (error) {
        sentLinkRef.current = null;
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not send the encrypted identity"
        );
      }
    })();
  }, [recoveryMode, deviceLinkId, deviceLinkKeys, deviceLinkStatus.data]);
  useEffect(() => {
    if (
      recoveryMode !== "recover" ||
      !deviceLinkStatus.data?.bundle ||
      !deviceLinkKeys ||
      !deviceLinkId ||
      consumedLinkRef.current === deviceLinkId
    )
      return;
    consumedLinkRef.current = deviceLinkId;
    void (async () => {
      try {
        await decryptIdentityFromDevice(
          deviceLinkKeys.privateKey,
          deviceLinkStatus.data.bundle as DeviceLinkBundle
        );
        await consumeDeviceLink.mutateAsync({ sessionId: deviceLinkId });
        setDeviceLinkMessage(
          "Your encrypted identity is restored on this device."
        );
        toast.success("This device is ready to open your encrypted chats");
      } catch (error) {
        consumedLinkRef.current = null;
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not restore this device"
        );
      }
    })();
  }, [recoveryMode, deviceLinkId, deviceLinkKeys, deviceLinkStatus.data]);
  useEffect(() => {
    if (
      recoveryMode !== "link" ||
      !deviceLinkId ||
      !deviceLinkKeys ||
      !qrCanvas.current
    )
      return;
    const payload = JSON.stringify({
      version: 1,
      sessionId: deviceLinkId,
      ownerPublicKey: JSON.stringify(deviceLinkKeys.publicKey),
    });
    void QRCode.toCanvas(qrCanvas.current, payload, {
      width: 240,
      margin: 2,
      color: { dark: "#101722", light: "#ffffff" },
    });
  }, [recoveryMode, deviceLinkId, deviceLinkKeys]);
  return (
    <>
      <div className="relative">
        <button
          onClick={() => setMenuOpen(value => !value)}
          className="flex items-center gap-2"
          aria-label="Open profile menu"
          aria-expanded={menuOpen}
        >
          <Avatar
            name={settings.data?.name ?? user.name}
            style={settings.data?.avatarStyle ?? style}
            image={settings.data?.profileImageUrl}
          />
          <span className="hidden md:block text-sm font-semibold">
            {settings.data?.name ?? user.name ?? "University user"}
          </span>
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-11 z-40 w-64 border border-slate-900/15 bg-white p-2 shadow-xl">
            <div className="px-3 py-2 border-b border-slate-900/10 flex gap-3">
              <Avatar
                name={settings.data?.name ?? user.name}
                style={settings.data?.avatarStyle ?? style}
                image={settings.data?.profileImageUrl}
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">
                  {settings.data?.name ?? user.name}
                </p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setMenuOpen(false);
                setRequestsOpen(true);
              }}
              className="mt-1 flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm font-medium hover:bg-[#c8f7f1]"
            >
              <UserRoundCheck className="h-4 w-4" />
              Friend requests
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                setProfileOpen(true);
              }}
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm font-medium hover:bg-[#c8f7f1]"
            >
              <Settings2 className="h-4 w-4" />
              Profile & settings
            </button>
            <button
              onClick={() => void onSignOut()}
              className="mt-1 w-full rounded-sm px-3 py-2 text-left text-sm font-medium hover:bg-[#ffd7e5]"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
      <Dialog open={requestsOpen} onOpenChange={setRequestsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Friend requests</DialogTitle>
            <DialogDescription>
              Accept a request before that person appears in your messages.
            </DialogDescription>
          </DialogHeader>
          {requests.data?.length ? (
            requests.data.map(request => (
              <div key={request.id} className="py-3 flex items-center gap-3">
                <Avatar name={request.sender.name} style="rose" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{request.sender.name}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {request.sender.email}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="rounded-sm"
                  onClick={() =>
                    respond.mutate({ requestId: request.id, action: "accept" })
                  }
                >
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-sm"
                  onClick={() =>
                    respond.mutate({ requestId: request.id, action: "decline" })
                  }
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          ) : (
            <p className="text-center text-sm text-slate-500 py-8">
              No pending friend requests.
            </p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={profileOpen}
        onOpenChange={open => {
          setProfileOpen(open);
          if (!open) stopScanner();
        }}
      >
        <DialogContent className="max-w-xl max-h-[calc(100svh-1rem)] overflow-y-auto rounded-2xl p-0 gap-0">
          <div className="bg-[#101722] text-white px-6 py-7 md:px-8">
            <div className="flex items-start gap-4">
              <button
                onClick={() => setProfileOpen(false)}
                aria-label="Back to chat"
                className="mt-1 grid h-9 w-9 place-items-center rounded-sm border border-white/15 text-white hover:bg-white/10"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <DialogHeader className="flex-1">
                <DialogTitle className="text-2xl font-black tracking-tight">
                  Your profile
                </DialogTitle>
                <DialogDescription className="text-white/65">
                  Identity, picture, and privacy in one place.
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="flex items-center gap-5 mt-7">
              <Avatar name={name} style={style} image={currentImage} large />
              <div>
                <p className="font-bold text-lg">
                  {name || "Your display name"}
                </p>
                <p className="text-sm text-white/65">
                  @{username || "username"}
                </p>
                <button
                  onClick={() => imageInput.current?.click()}
                  className="mt-3 text-xs font-mono uppercase tracking-wider text-[#c8f7f1] hover:underline"
                >
                  <ImagePlus className="h-3.5 w-3.5 inline mr-1.5" />
                  {currentImage ? "Change picture" : "Upload picture"}
                </button>
                {currentImage && (
                  <button
                    onClick={() => {
                      setImageData(null);
                      setImageType(null);
                      setRemoveImage(true);
                    }}
                    className="ml-3 text-xs font-mono uppercase tracking-wider text-white/60 hover:text-white hover:underline"
                  >
                    Use avatar
                  </button>
                )}
                <input
                  ref={imageInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={chooseImage}
                />
              </div>
            </div>
          </div>
          <div className="p-6 md:p-8 space-y-8">
            <section>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-3">
                Identity
              </p>
              <label className="text-sm font-semibold block mb-2">
                Display name
              </label>
              <Input
                value={name}
                maxLength={60}
                onChange={event => setName(event.target.value)}
                className="rounded-sm h-11"
              />
              <label className="text-sm font-semibold block mt-4 mb-2">
                Username
              </label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-slate-400">@</span>
                <Input
                  value={username}
                  maxLength={24}
                  onChange={event =>
                    setUsername(event.target.value.replace(/^@+/, ""))
                  }
                  className="rounded-sm h-11 pl-7"
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Letters, numbers, dots, and underscores only.
              </p>
              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                <div className="border border-slate-200 rounded-sm p-3">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-slate-400">
                    Matric number
                  </p>
                  <p className="text-sm font-semibold mt-1">
                    {settings.data?.matricNumber ?? user.matricNumber}
                  </p>
                </div>
                <div className="border border-slate-200 rounded-sm p-3">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-slate-400">
                    Email
                  </p>
                  <p className="text-sm font-semibold mt-1 truncate">
                    {settings.data?.email ?? user.email}
                  </p>
                </div>
              </div>
            </section>
            <section>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-3">
                Illustrated avatar
              </p>
              <div className="grid grid-cols-4 gap-3">
                {(["ink", "mint", "rose", "violet"] as Style[]).map(option => (
                  <button
                    key={option}
                    onClick={() => {
                      setStyle(option);
                      setRemoveImage(true);
                    }}
                    className={`border rounded-xl p-3 grid place-items-center gap-2 ${style === option && removeImage ? "border-[#101722] bg-slate-50" : "border-slate-200 hover:bg-slate-50"}`}
                    aria-label={`Choose ${option} avatar`}
                  >
                    <Avatar name={name} style={option} />
                    <span className="font-mono text-[9px] uppercase tracking-wider">
                      {option}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Use an illustrated avatar or upload a JPG, PNG, or WebP picture
                up to 512 KB.
              </p>
            </section>
            <section className="border-y border-slate-100 py-5 flex items-center justify-between gap-5">
              <div>
                <p className="text-sm font-semibold">Read receipts</p>
                <p className="text-xs text-slate-500 mt-1">
                  Let others know when you read their messages.
                </p>
              </div>
              <Switch
                aria-label="Read receipts"
                checked={settings.data?.readReceiptsEnabled ?? true}
                onCheckedChange={readReceiptsEnabled =>
                  updatePrivacy.mutate({ readReceiptsEnabled })
                }
              />
            </section>
            <section>
              <div className="flex items-center gap-2">
                <ShieldBan className="h-4 w-4" />
                <p className="text-sm font-semibold">Blocked users</p>
              </div>
              {blocked.data?.length ? (
                <div className="mt-2 divide-y divide-slate-100">
                  {blocked.data.map(profile => (
                    <div
                      key={profile.id}
                      className="flex items-center justify-between py-3"
                    >
                      <span className="text-sm">
                        {profile.name ?? profile.email}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-sm"
                        onClick={() => unblock.mutate({ userId: profile.id })}
                      >
                        Unblock
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">No blocked users.</p>
              )}
            </section>
            <section className="rounded-2xl border border-[#d4b3c9]/60 bg-[#fff8fc] p-4 md:p-5">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                <p className="text-sm font-semibold">Link a new device</p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Move your encrypted identity to another signed-in device without
                sharing a passphrase. The link expires after 3 minutes and works
                once.
              </p>
              {recoveryMode === "idle" && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Button
                    className="h-11 rounded-xl"
                    onClick={() => void startLink()}
                    disabled={recoveryBusy}
                  >
                    <QrCode className="mr-2 h-4 w-4" />
                    Link new device
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 rounded-xl"
                    onClick={() => void startScanner()}
                    disabled={recoveryBusy}
                  >
                    <ScanLine className="mr-2 h-4 w-4" />
                    Recover chats from another device
                  </Button>
                </div>
              )}
              {recoveryMode === "link" && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-center">
                  <p className="text-sm font-semibold">
                    Scan this QR code on your new device
                  </p>
                  <canvas
                    ref={qrCanvas}
                    className="mx-auto mt-4 h-60 w-60 max-w-full rounded-xl"
                    aria-label="SecureChat device link QR code"
                  />
                  <p className="mt-3 text-xs text-slate-500">
                    {deviceLinkMessage}
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                    Expires{" "}
                    {deviceLinkStatus.data?.expiresAt
                      ? new Date(
                          deviceLinkStatus.data.expiresAt
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "in 3 minutes"}
                  </p>
                  <div className="mt-4 flex justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      onClick={() => void copyQrPayload()}
                    >
                      <QrCode className="mr-2 h-3.5 w-3.5" />
                      Copy code
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-lg"
                      onClick={() => {
                        setRecoveryMode("idle");
                        setDeviceLinkId(null);
                        setDeviceLinkKeys(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              {recoveryMode === "recover" && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold">
                    Recovering encrypted chats
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">
                    {deviceLinkMessage}
                  </p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full w-2/3 animate-pulse rounded-full bg-[#b9f2e8]" />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 rounded-lg"
                    onClick={() => {
                      setRecoveryMode("idle");
                      setDeviceLinkId(null);
                      setDeviceLinkKeys(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
              <button
                type="button"
                className="mt-4 text-xs font-semibold text-slate-500 underline-offset-4 hover:text-[#101722] hover:underline"
                onClick={() => setFileFallbackOpen(value => !value)}
              >
                Use a recovery file instead
              </button>
              {fileFallbackOpen && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs leading-relaxed text-slate-500">
                    Recovery files remain available when QR scanning is
                    unavailable, such as on a desktop without a camera.
                  </p>
                  <Input
                    type="password"
                    value={recoveryPassphrase}
                    onChange={event =>
                      setRecoveryPassphrase(event.target.value)
                    }
                    placeholder="Use 12+ characters"
                    className="mt-3 h-10 rounded-lg"
                    aria-label="Recovery passphrase"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      onClick={() => void exportRecovery()}
                      disabled={recoveryBusy || recoveryPassphrase.length < 12}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export recovery file
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      onClick={() => recoveryInput.current?.click()}
                      disabled={recoveryBusy || recoveryPassphrase.length < 12}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Import recovery file
                    </Button>
                  </div>
                </div>
              )}
              <input
                ref={recoveryInput}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={importRecovery}
              />
            </section>
            <section className="rounded-sm bg-slate-50 border border-slate-200 p-4">
              <div className="flex gap-2 items-center">
                <LockKeyhole className="h-4 w-4" />
                <p className="text-sm font-semibold">Account status</p>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Your profile photo is private. It is shown only through
                SecureChat’s authorized account access.
              </p>
            </section>
            <DialogFooter className="sm:justify-between gap-3">
              <Button
                variant="outline"
                className="rounded-sm"
                onClick={() => void onSignOut()}
              >
                Sign out
              </Button>
              <Button
                className="rounded-sm"
                onClick={save}
                disabled={updateProfile.isPending}
              >
                {updateProfile.isPending ? "Saving..." : "Save profile"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={scannerOpen}
        onOpenChange={open => {
          setScannerOpen(open);
          if (!open) stopScanner();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scan SecureChat QR code</DialogTitle>
            <DialogDescription>
              Point your camera at the QR code shown on the device that already
              has your encrypted chats.
            </DialogDescription>
          </DialogHeader>
          <div className="relative mt-3 overflow-hidden rounded-2xl bg-[#101722] aspect-square">
            <video
              ref={scannerVideo}
              className="h-full w-full object-cover"
              muted
              playsInline
              aria-label="QR scanner camera preview"
            />
            <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-[#c8f7f1]" />
          </div>
          {cameraError && (
            <p className="mt-3 rounded-xl bg-[#fff8fc] p-3 text-xs leading-relaxed text-slate-600">
              {cameraError}
            </p>
          )}
          <Button
            variant="outline"
            className="mt-3 w-full rounded-xl"
            onClick={() => {
              setScannerOpen(false);
              stopScanner();
              setFileFallbackOpen(true);
            }}
          >
            Use recovery file instead
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
