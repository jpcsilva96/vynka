import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { answerConfirm, useConfirmDialog } from "@/lib/confirm-dialog";
import { cn } from "@/lib/utils";

// Janela única de confirmação do painel e do master (ver lib/confirm-dialog.ts).
export function ConfirmDialogHost() {
  const dialog = useConfirmDialog();
  return (
    <AlertDialog open={dialog.open} onOpenChange={(open) => !open && answerConfirm(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{dialog.title}</AlertDialogTitle>
          {dialog.description && (
            <AlertDialogDescription className="whitespace-pre-line">
              {dialog.description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => answerConfirm(false)}>
            {dialog.cancelLabel ?? "Voltar"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => answerConfirm(true)}
            className={cn(dialog.destructive && "bg-red-600 text-white hover:bg-red-700")}
          >
            {dialog.confirmLabel ?? "Confirmar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
