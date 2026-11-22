/**
 * Content locale counts endpoint - injected by EmDash integration
 *
 * GET /_emdash/api/content/{collection}/locale-counts - Number of live entries
 * per locale, in every status, for the admin content-list locale switcher.
 */

import type { APIRoute } from "astro";

import { requirePerm } from "#api/authorize.js";
import { apiError, unwrapResult } from "#api/error.js";

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
	const { emdash, user } = locals;
	const collection = params.collection!;

	if (!emdash?.handleContentLocaleCounts) {
		return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
	}
	// Counts include drafts, so they need the tier that lets the list show drafts.
	const denied = requirePerm(user, "content:read_drafts");
	if (denied) return denied;

	const result = await emdash.handleContentLocaleCounts(collection);

	return unwrapResult(result);
};
