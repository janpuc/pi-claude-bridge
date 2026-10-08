#!/usr/bin/env node
// A cache breakpoint an extension puts on a user text block reaches the Claude Code
// session unchanged, and nothing else does. Claude Code sends a stored block's
// cache_control to the API as is (measured with a capture proxy on CC 2.1.293), so
// this is how an extension that rebuilds its context every turn keeps its stable
// prefix cached across turns.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { convertPiMessages } from "../src/convert.js";

const user = (content) => ({ role: "user", content, timestamp: 0 });
const blocks = (messages) => convertPiMessages(messages).anthropicMessages[0].content;

describe("convertPiMessages: cache marks on user text", () => {
	it("keeps a 1h mark on the block that carries it", () => {
		const out = blocks([user([
			{ type: "text", text: "<chat>\nline 0\n" },
			{ type: "text", text: "line 1\n", cache_control: { type: "ephemeral", ttl: "1h" } },
			{ type: "text", text: "question" },
		])]);
		assert.deepEqual(out, [
			{ type: "text", text: "<chat>\nline 0\n" },
			{ type: "text", text: "line 1\n", cache_control: { type: "ephemeral", ttl: "1h" } },
			{ type: "text", text: "question" },
		]);
	});

	it("keeps a mark without a ttl", () => {
		assert.deepEqual(blocks([user([{ type: "text", text: "a", cache_control: { type: "ephemeral" } }])]),
			[{ type: "text", text: "a", cache_control: { type: "ephemeral" } }]);
	});

	it("drops a malformed mark and any other extra field", () => {
		const out = blocks([user([
			{ type: "text", text: "a", cache_control: { type: "persistent" } },
			{ type: "text", text: "b", cache_control: { type: "ephemeral", ttl: "24h" } },
			{ type: "text", text: "c", cache_control: "ephemeral", extra: 1 },
		])]);
		assert.deepEqual(out, [{ type: "text", text: "a" }, { type: "text", text: "b" }, { type: "text", text: "c" }]);
	});

	it("leaves unmarked messages exactly as before", () => {
		assert.deepEqual(blocks([user([{ type: "text", text: "plain" }])]), [{ type: "text", text: "plain" }]);
		assert.equal(convertPiMessages([user("string content")]).anthropicMessages[0].content, "string content");
	});
});
