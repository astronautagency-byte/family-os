# Visual refresh and calendar image import

Implemented the homepage photo/product composition, actual-component previews, reduced repeated sections, shared app/website illustration family, responsive WebP variants, and shared 12px control / 18px card geometry. Preserved user colour schemes and existing billing logic.

Calendar → Import image supports 1–3 JPEG/PNG/WebP photos. Extraction produces editable drafts; missing/uncertain fields need review. No events save until selected drafts validate. Duplicate title/start events are skipped and successful partial saves are not repeated on retry. Uploaded images are sent to the configured AI provider only after Read images; originals are not persisted.

Validation: production build passed. 18 focused Node tests and 10 component tests passed. Full Node suite: 245/247 passed; existing failures concern mobile chat spacing and the removed Cook from what you have option. Impeccable final targeted detector: no findings. Desktop 1280px and mobile 390px visual checks completed; secondary sign-in contrast corrected. Supabase import-calendar-image ACTIVE v1; unauthenticated call returns 401. Authenticated live extraction and real household persistence are not verified in this session.

Website photo source is 1536×1024, delivered responsively without upscaling. Product screenshots show synthetic household data, explicitly labelled. No private customer data was used.
