import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import {
  grantAccess,
  revokeAccess,
  updateAccessLevel,
} from "@/services/admin/permissionService";

export interface ResourceGrant {
  id: string;
  resource_type: string;
  resource_id: string;
  grantee_type: "user" | "team";
  grantee_id: string;
  access_level: "viewer" | "editor";
  granted_by: string | null;
  created_at: string;
  grantee_name?: string;
}

export function useResourceAccess(
  resourceType: string,
  resourceId: string | undefined,
  nameMap?: Record<string, string>,
) {
  const queryClient = useQueryClient();
  const { tenantId } = useUserRole();

  const resolveResourceTenantId = async (): Promise<string | null> => {
    if (!resourceId) return null;

    if (resourceType === "dashboard") {
      const { data, error } = await supabase.from("dashboards").select("tenant_id").eq("id", resourceId).maybeSingle();
      if (error) throw error;
      return data?.tenant_id ?? tenantId;
    }

    if (resourceType === "flow_map") {
      const { data, error } = await supabase.from("flow_maps").select("tenant_id").eq("id", resourceId).maybeSingle();
      if (error) throw error;
      return data?.tenant_id ?? tenantId;
    }

    return tenantId;
  };

  const { data: grants = [], isLoading } = useQuery({
    queryKey: ["resource-access", resourceType, resourceId],
    enabled: !!resourceId && !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resource_access")
        .select("*")
        .eq("resource_type", resourceType)
        .eq("resource_id", resourceId!);
      if (error) throw error;
      return (data ?? []) as ResourceGrant[];
    },
  });

  const enrichedGrants: ResourceGrant[] = grants.map((g) => ({
    ...g,
    grantee_name: nameMap?.[g.grantee_id] || g.grantee_id,
  }));

  const addGrant = useMutation({
    mutationFn: async (params: { grantee_type: "user" | "team"; grantee_id: string; access_level: "viewer" | "editor" }) => {
      if (!resourceId) throw new Error("Contexto ausente: resourceId não definido");
      const resolvedTenantId = await resolveResourceTenantId();
      if (!resolvedTenantId) throw new Error("Tenant do recurso não identificado");

      await grantAccess({
        tenant_id: resolvedTenantId,
        resource_type: resourceType,
        resource_id: resourceId,
        grantee_type: params.grantee_type,
        grantee_id: params.grantee_id,
        access_level: params.access_level,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["resource-access", resourceType, resourceId] }),
  });

  const removeGrant = useMutation({
    mutationFn: async (grantId: string) => {
      await revokeAccess(grantId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["resource-access", resourceType, resourceId] }),
  });

  const updateLevel = useMutation({
    mutationFn: async (params: { grantId: string; access_level: "viewer" | "editor" }) => {
      await updateAccessLevel(params.grantId, params.access_level);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["resource-access", resourceType, resourceId] }),
  });

  return { grants: enrichedGrants, isLoading, addGrant, removeGrant, updateLevel };
}
