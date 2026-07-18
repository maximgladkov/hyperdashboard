"use client";

import {
  getExistingSubscription,
  isIOS,
  isPushSupported,
  isStandalone,
  registerServiceWorker,
  saveSubscriptionForAddress,
  subscribeToPush,
} from "@/lib/push-client";
import { Alert, Button } from "@heroui/react";
import { useEffect, useState } from "react";

type Status = "checking" | "unsupported" | "ios-needs-install" | "needs-permission" | "denied" | "subscribed" | "error";

export default function NotificationPrompt({ address }: { address: string }) {
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (!isPushSupported()) {
        if (isIOS() && !isStandalone()) {
          if (!cancelled) setStatus("ios-needs-install");
        } else if (!cancelled) {
          setStatus("unsupported");
        }
        return;
      }

      await registerServiceWorker();
      if (cancelled) return;

      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }

      const existing = await getExistingSubscription();
      if (cancelled) return;

      if (Notification.permission === "granted" && existing) {
        await saveSubscriptionForAddress(address, existing);
        if (cancelled) return;
        setStatus("subscribed");
        return;
      }

      setStatus("needs-permission");
    };

    check().catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [address]);

  const handleEnable = async () => {
    setSubscribing(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }
      await subscribeToPush(address);
      setStatus("subscribed");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    } finally {
      setSubscribing(false);
    }
  };

  if (status === "checking" || status === "unsupported" || status === "subscribed") {
    return null;
  }

  if (status === "ios-needs-install") {
    return (
      <Alert className="mb-4" status="accent">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Install for notifications</Alert.Title>
          <Alert.Description>
            Add this app to your home screen (tap Share, then &quot;Add to Home Screen&quot;) to enable position-close alerts.
          </Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }

  if (status === "denied") {
    return (
      <Alert className="mb-4" status="warning">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Notifications blocked</Alert.Title>
          <Alert.Description>
            Enable notifications for this app in your device settings to get alerted when a position closes.
          </Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }

  return (
    <Alert className="mb-4" status={status === "error" ? "danger" : "accent"}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>Get notified when a position closes</Alert.Title>
        <Alert.Description>{error ?? "Enable push notifications to hear about it the moment it happens."}</Alert.Description>
        <Button className="mt-2 sm:hidden" size="sm" variant="primary" isPending={subscribing} onPress={handleEnable}>
          Enable notifications
        </Button>
      </Alert.Content>
      <Button className="hidden sm:block" size="sm" variant="primary" isPending={subscribing} onPress={handleEnable}>
        Enable notifications
      </Button>
    </Alert>
  );
}
