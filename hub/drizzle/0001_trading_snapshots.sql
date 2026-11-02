CREATE TABLE "trading_snapshots" (
	"name" text PRIMARY KEY NOT NULL,
	"json" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trading_snapshots_name_chk" CHECK ("trading_snapshots"."name" in ('positions', 'trades', 'equity_live', 'recommendations', 'status', 'backtest', 'kronos_eval'))
);
