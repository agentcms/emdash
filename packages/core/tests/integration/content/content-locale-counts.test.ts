import { beforeEach, afterEach, expect, it } from "vitest";

import {
	handleContentCreate,
	handleContentDelete,
	handleContentLocaleCounts,
} from "../../../src/api/handlers/content.js";
import { SchemaRegistry } from "../../../src/schema/registry.js";
import {
	describeEachDialect,
	setupForDialect,
	teardownForDialect,
	type DialectTestContext,
} from "../../utils/test-db.js";

describeEachDialect("content locale counts", (dialect) => {
	let ctx: DialectTestContext;

	beforeEach(async () => {
		ctx = await setupForDialect(dialect);
		const registry = new SchemaRegistry(ctx.db);
		await registry.createCollection({ slug: "posts", label: "Posts", labelSingular: "Post" });
		await registry.createField("posts", { slug: "title", label: "Title", type: "string" });
	});

	afterEach(async () => {
		await teardownForDialect(ctx);
	});

	async function create(slug: string, locale: string, status?: string): Promise<string> {
		const created = await handleContentCreate(ctx.db, "posts", {
			slug,
			locale,
			data: { title: slug },
			...(status ? { status } : {}),
		});
		if (!created.success) throw new Error(`seed ${slug} failed`);
		return created.data.item.id;
	}

	it("counts live entries per locale across statuses and skips trashed ones", async () => {
		await create("a", "de-at");
		await create("b", "de-at", "published");
		await create("c", "it-it");
		const trashed = await create("d", "it-it");
		const deleted = await handleContentDelete(ctx.db, "posts", trashed);
		if (!deleted.success) throw new Error("delete failed");

		const result = await handleContentLocaleCounts(ctx.db, "posts");
		if (!result.success) throw new Error("counts failed");
		expect(result.data.counts).toEqual({ "de-at": 2, "it-it": 1 });
		expect(result.data.total).toBe(3);
	});

	it("returns no counts for an empty collection", async () => {
		const result = await handleContentLocaleCounts(ctx.db, "posts");
		if (!result.success) throw new Error("counts failed");
		expect(result.data).toEqual({ counts: {}, total: 0 });
	});

	it("reports an unknown collection as not found", async () => {
		const result = await handleContentLocaleCounts(ctx.db, "missing");
		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.error.code).toBe("COLLECTION_NOT_FOUND");
	});
});
