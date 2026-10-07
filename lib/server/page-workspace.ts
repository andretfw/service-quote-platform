import "server-only";
import { redirect } from "next/navigation";
import { requireWorkspace } from "./workspace";
import { HttpError } from "./http";

export async function pageWorkspace() {
  try {
    return await requireWorkspace();
  } catch (error) {
    if (error instanceof HttpError && [401, 503].includes(error.status)) redirect("/login");
    throw error;
  }
}
