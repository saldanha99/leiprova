CREATE TABLE "opportunity_requirement_articles" (
	"requirement_id" bigint NOT NULL,
	"legal_article_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "opportunity_requirement_articles_requirement_id_legal_article_id_pk" PRIMARY KEY("requirement_id","legal_article_id")
);
--> statement-breakpoint
ALTER TABLE "opportunity_requirement_articles" ADD CONSTRAINT "opportunity_requirement_articles_requirement_id_opportunity_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."opportunity_requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_requirement_articles" ADD CONSTRAINT "opportunity_requirement_articles_legal_article_id_legal_articles_id_fk" FOREIGN KEY ("legal_article_id") REFERENCES "public"."legal_articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "opportunity_requirement_articles_article_idx" ON "opportunity_requirement_articles" USING btree ("legal_article_id");