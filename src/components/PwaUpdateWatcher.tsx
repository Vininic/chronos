import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "sonner";
import { useEffect } from "react";

export function PwaUpdateWatcher() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onOfflineReady() {
      toast.success("App ready for offline use");
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    const id = toast("Update available", {
      description: "A new version is ready.",
      action: {
        label: "Update",
        onClick: () => {
          updateServiceWorker(true);
          toast.dismiss(id);
        },
      },
      duration: Infinity,
    });
  }, [needRefresh, updateServiceWorker]);

  return null;
}
