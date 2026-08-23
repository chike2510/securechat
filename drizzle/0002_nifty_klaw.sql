ALTER TABLE `users` ADD `universityEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `users` ADD `matricNumber` varchar(40);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` text;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_universityEmail_unique` UNIQUE(`universityEmail`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_matricNumber_unique` UNIQUE(`matricNumber`);