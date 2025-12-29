import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertMacro, type UpdateMacroRequest } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useMacros() {
  const { toast } = useToast();
  
  return useQuery({
    queryKey: [api.macros.list.path],
    queryFn: async () => {
      const res = await fetch(api.macros.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch macros");
      return api.macros.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateMacro() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertMacro) => {
      const res = await fetch(api.macros.create.path, {
        method: api.macros.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.macros.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create macro");
      }
      return api.macros.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.macros.list.path] });
      toast({ title: "Macro Created", description: "Your custom command is ready." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
}

export function useUpdateMacro() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & UpdateMacroRequest) => {
      const url = buildUrl(api.macros.update.path, { id });
      const res = await fetch(url, {
        method: api.macros.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 404) throw new Error("Macro not found");
        throw new Error("Failed to update macro");
      }
      return api.macros.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.macros.list.path] });
      toast({ title: "Macro Updated" });
    },
  });
}

export function useDeleteMacro() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.macros.delete.path, { id });
      const res = await fetch(url, {
        method: api.macros.delete.method,
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to delete macro");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.macros.list.path] });
      toast({ title: "Macro Deleted", variant: "destructive" });
    },
  });
}
