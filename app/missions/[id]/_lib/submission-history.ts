import { fetchAllRows, fetchByIdChunks } from "@/lib/supabase/fetch-all-rows";
import type { Database, Tables } from "@/lib/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MissionArtifact, SubmissionData } from "./types";

/** ID ごとに複数行がひもづく取得を、ID を分割し、各回の中でも全件取得する */
function fetchAllByIdChunks<T>(
  ids: string[],
  fetchPage: (
    chunk: string[],
    from: number,
    to: number,
  ) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
): Promise<T[]> {
  return fetchByIdChunks(ids, async (chunk) => ({
    data: await fetchAllRows<T>((from, to) => fetchPage(chunk, from, to)),
    error: null,
  }));
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = groups.get(key(item));
    if (group) {
      group.push(item);
    } else {
      groups.set(key(item), [item]);
    }
  }
  return groups;
}

/**
 * 本人のあるグッジョブの提出履歴を、新しい順にすべて取る。取得に失敗したら例外にする。
 * サーバーの初期表示と、投稿後のクライアントでの取り直しの両方で使う。
 */
export async function fetchSubmissionHistory(
  supabase: SupabaseClient<Database>,
  userId: string,
  missionId: string,
): Promise<SubmissionData[]> {
  const achievements = await fetchAllRows<{ id: string; created_at: string }>(
    (from, to) =>
      supabase
        .from("achievements")
        .select("id, created_at")
        .eq("user_id", userId)
        .eq("mission_id", missionId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to),
  );
  if (achievements.length === 0) {
    return [];
  }

  const artifacts = await fetchAllByIdChunks<Tables<"mission_artifacts">>(
    achievements.map((achievement) => achievement.id),
    (chunk, from, to) =>
      supabase
        .from("mission_artifacts")
        .select("*")
        .in("achievement_id", chunk)
        .order("id", { ascending: true })
        .range(from, to),
  );

  const geolocations = await fetchAllByIdChunks<
    Tables<"mission_artifact_geolocations">
  >(
    artifacts
      .filter((artifact) => artifact.artifact_type === "IMAGE_WITH_GEOLOCATION")
      .map((artifact) => artifact.id),
    (chunk, from, to) =>
      supabase
        .from("mission_artifact_geolocations")
        .select("*")
        .in("mission_artifact_id", chunk)
        .order("id", { ascending: true })
        .range(from, to),
  );
  const geolocationsByArtifact = groupBy(
    geolocations,
    (geolocation) => geolocation.mission_artifact_id,
  );

  const artifactsWithDetails = await Promise.all(
    artifacts.map(async (artifact): Promise<MissionArtifact> => {
      const geolocations = geolocationsByArtifact.get(artifact.id);
      const withGeolocations = geolocations
        ? { ...artifact, geolocations }
        : artifact;
      if (!artifact.image_storage_path) {
        return withGeolocations;
      }
      const { data: signedUrlData } = await supabase.storage
        .from("mission_artifact_files")
        .createSignedUrl(artifact.image_storage_path, 60, {
          transform: { width: 240, height: 240, resize: "contain" },
        });
      return signedUrlData
        ? { ...withGeolocations, image_storage_path: signedUrlData.signedUrl }
        : withGeolocations;
    }),
  );
  const artifactsByAchievement = groupBy(
    artifactsWithDetails,
    (artifact) => artifact.achievement_id,
  );

  return achievements.map((achievement) => ({
    id: achievement.id,
    created_at: achievement.created_at,
    mission_id: missionId,
    user_id: userId,
    artifacts: artifactsByAchievement.get(achievement.id) ?? [],
  }));
}
