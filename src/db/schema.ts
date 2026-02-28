import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core";

export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

export const speakers = sqliteTable("speakers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
});

export const videos = sqliteTable("videos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  youtubeId: text("youtube_id").notNull().unique(),
  url: text("url"),
  title: text("title"),
  publishedAt: text("published_at"),
  views: integer("views").default(0),
  likes: integer("likes").default(0),
  lastUpdated: text("last_updated"),
  eventId: integer("event_id").references(() => events.id),
  excludeFromCharts: integer("exclude_from_charts").default(0).notNull(),
});

export const videoSpeakers = sqliteTable(
  "video_speakers",
  {
    videoId: integer("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    speakerId: integer("speaker_id")
      .notNull()
      .references(() => speakers.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.videoId, table.speakerId] })]
);

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const statsHistory = sqliteTable("stats_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  videoId: integer("video_id")
    .notNull()
    .references(() => videos.id, { onDelete: "cascade" }),
  views: integer("views").default(0),
  likes: integer("likes").default(0),
  recordedAt: text("recorded_at").notNull(),
});

// ─── Transcript & Categorization Tables ──────────────────────────────

export const transcripts = sqliteTable("transcripts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  videoId: integer("video_id")
    .notNull()
    .unique()
    .references(() => videos.id, { onDelete: "cascade" }),
  language: text("language").notNull(),
  isGenerated: integer("is_generated").default(0).notNull(),
  wordCount: integer("word_count").default(0),
  fullText: text("full_text").notNull(),
  entries: text("entries").notNull(), // JSON array of {text, start, duration}
  fetchedAt: text("fetched_at").notNull(),
});

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  relatedThemes: text("related_themes"), // JSON array of theme strings
});

export const videoSummaries = sqliteTable("video_summaries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  videoId: integer("video_id")
    .notNull()
    .unique()
    .references(() => videos.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  themes: text("themes"), // JSON array
  keyQuotes: text("key_quotes"), // JSON array
  tone: text("tone"),
  summarizedAt: text("summarized_at").notNull(),
});

export const videoCategories = sqliteTable(
  "video_categories",
  {
    videoId: integer("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    isPrimary: integer("is_primary").default(0).notNull(),
    relevanceScore: real("relevance_score").default(0),
  },
  (table) => [primaryKey({ columns: [table.videoId, table.categoryId] })]
);

export const clips = sqliteTable("clips", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  videoId: integer("video_id")
    .notNull()
    .references(() => videos.id, { onDelete: "cascade" }),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  startTime: real("start_time").notNull(),
  endTime: real("end_time").notNull(),
  description: text("description"),
  quoteSnippet: text("quote_snippet"),
  relevanceScore: real("relevance_score").default(0),
  generatedAt: text("generated_at").notNull(),
});
