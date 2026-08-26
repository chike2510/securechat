CREATE TABLE "conversationParticipants" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversationId" integer NOT NULL,
	"userId" integer NOT NULL,
	"joinedAt" timestamp DEFAULT now() NOT NULL,
	"lastReadAt" timestamp,
	CONSTRAINT "conversation_participant_unique" UNIQUE("conversationId","userId")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "encryptedMessages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversationId" integer NOT NULL,
	"senderId" integer NOT NULL,
	"ciphertext" text NOT NULL,
	"iv" varchar(128) NOT NULL,
	"keyVersion" varchar(64) DEFAULT 'v1' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"deliveredAt" timestamp,
	"readAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "messageStatuses" (
	"id" serial PRIMARY KEY NOT NULL,
	"messageId" integer NOT NULL,
	"userId" integer NOT NULL,
	"status" varchar(16) DEFAULT 'sent' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "message_status_user_unique" UNIQUE("messageId","userId")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"type" varchar(32) NOT NULL,
	"title" varchar(160) NOT NULL,
	"body" text NOT NULL,
	"conversationId" integer,
	"isRead" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"universityEmail" varchar(320),
	"matricNumber" varchar(40) NOT NULL,
	"passwordHash" text,
	"loginMethod" varchar(64),
	"role" varchar(16) DEFAULT 'user' NOT NULL,
	"publicKey" text,
	"lastSeenAt" timestamp,
	"isOnline" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId"),
	CONSTRAINT "users_universityEmail_unique" UNIQUE("universityEmail"),
	CONSTRAINT "users_matricNumber_unique" UNIQUE("matricNumber")
);
