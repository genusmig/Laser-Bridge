import { useState } from "react";
import { Card, Button, Input } from "@/components/ui/shared";
import { useMacros, useCreateMacro, useDeleteMacro, useUpdateMacro } from "@/hooks/use-macros";
import { Plus, Trash2, Edit2, Play } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { Cross2Icon } from "@radix-ui/react-icons";
import { type InsertMacro } from "@shared/schema";

interface MacroListProps {
  onSend: (gcode: string) => void;
}

export function MacroList({ onSend }: MacroListProps) {
  const { data: macros, isLoading } = useMacros();
  const createMacro = useCreateMacro();
  const deleteMacro = useDeleteMacro();
  
  const [isOpen, setIsOpen] = useState(false);
  const [newMacro, setNewMacro] = useState<InsertMacro>({ name: "", gcode: "", color: "blue" });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMacro.mutate(newMacro, {
      onSuccess: () => {
        setIsOpen(false);
        setNewMacro({ name: "", gcode: "", color: "blue" });
      }
    });
  };

  const getColorClass = (color: string | null) => {
    switch(color) {
      case 'red': return 'bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/20';
      case 'green': return 'bg-green-500/10 hover:bg-green-500/20 text-green-500 border-green-500/20';
      case 'amber': return 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border-amber-500/20';
      default: return 'bg-primary/10 hover:bg-primary/20 text-primary border-primary/20';
    }
  };

  if (isLoading) return <div className="h-32 flex items-center justify-center text-muted-foreground animate-pulse">Loading Macros...</div>;

  return (
    <Card className="p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-widest">Macros</h2>
        <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
          <Dialog.Trigger asChild>
            <Button size="sm" variant="outline" className="h-7 w-7 p-0 rounded-full">
              <Plus className="w-4 h-4" />
            </Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" />
            <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg">
              <div className="flex flex-col space-y-1.5 text-center sm:text-left">
                <Dialog.Title className="text-lg font-semibold leading-none tracking-tight">Create Macro</Dialog.Title>
                <Dialog.Description className="text-sm text-muted-foreground">Add a custom G-code sequence.</Dialog.Description>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input value={newMacro.name} onChange={e => setNewMacro({...newMacro, name: e.target.value})} placeholder="e.g. Probe Z" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">G-Code</label>
                  <Input value={newMacro.gcode} onChange={e => setNewMacro({...newMacro, gcode: e.target.value})} placeholder="G21 G91..." required />
                </div>
                <div className="space-y-2">
                   <label className="text-sm font-medium">Color</label>
                   <select 
                     className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                     value={newMacro.color || "blue"}
                     onChange={e => setNewMacro({...newMacro, color: e.target.value})}
                   >
                     <option value="blue">Blue</option>
                     <option value="red">Red</option>
                     <option value="green">Green</option>
                     <option value="amber">Amber</option>
                   </select>
                </div>
                <div className="flex justify-end gap-2">
                   <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                   <Button type="submit" disabled={createMacro.isPending}>{createMacro.isPending ? "Saving..." : "Save Macro"}</Button>
                </div>
              </form>
              <Dialog.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                <Cross2Icon className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      <div className="grid grid-cols-2 gap-3 overflow-y-auto max-h-[300px] pr-1">
        {macros?.map((macro) => (
          <div key={macro.id} className="group relative flex gap-2">
             <Button 
               variant="outline" 
               className={`flex-1 justify-start gap-2 border-l-4 ${getColorClass(macro.color)}`}
               onClick={() => onSend(macro.gcode)}
               title={macro.gcode}
             >
               <Play className="w-3 h-3" />
               <span className="truncate">{macro.name}</span>
             </Button>
             <Button 
               variant="ghost" 
               className="w-8 px-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity absolute right-0 top-0 h-full bg-card/80"
               onClick={() => deleteMacro.mutate(macro.id)}
             >
               <Trash2 className="w-3 h-3" />
             </Button>
          </div>
        ))}
        {macros?.length === 0 && (
          <div className="col-span-2 text-center py-8 text-xs text-muted-foreground border border-dashed rounded-lg border-border/50">
            No macros defined
          </div>
        )}
      </div>
    </Card>
  );
}
