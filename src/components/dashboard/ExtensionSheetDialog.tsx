import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getExtension } from "@/lib/extensions/registry";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  blockExtensionId: string;
  blockData: unknown;
  categoryConfig?: unknown;
  categoryId: string;
  categoryLabel: string;
  onClose: () => void;
}

export function ExtensionSheetDialog({
  blockExtensionId,
  blockData,
  categoryId: _categoryId,
  categoryLabel,
  onClose,
}: Props) {
  const { bcp47 } = useI18n();
  const ext = getExtension(blockExtensionId);
  const isPt = bcp47.toLowerCase().startsWith("pt");

  if (!ext) return null;

  const ctx = {
    categoryId: _categoryId,
    categoryConfig: undefined,
    selectedDate: new Date().toISOString().slice(0, 10),
    routines: [],
    commitments: [],
    addRoutine: () => null,
    addCommitment: () => null,
    updateCategoryConfig: () => {},
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[calc(100dvh-4rem)] overflow-y-auto">
        <DialogHeader className="flex-row items-center justify-between">
          <DialogTitle className="font-display text-xl text-primary flex items-center gap-2">
            <ext.icon className="h-4 w-4" />
            {categoryLabel} — {ext.label}
          </DialogTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
            <span className="sr-only">{isPt ? "Fechar" : "Close"}</span>
          </Button>
        </DialogHeader>
        <div className="py-2">
          {ext.renderSheet ? (
            ext.renderSheet(blockData, ctx as any)
          ) : (
            <p className="text-sm text-muted-foreground italic">
              {isPt ? "Nenhuma visualização disponível." : "No sheet view available."}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
