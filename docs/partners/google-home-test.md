# Google Home calendar test

This is a test plan, not a claim of a working direct FamOS voice integration. Google Home creates the event in Google Calendar; FamOS must sync that calendar before it can display the event. Google says the default is the linked account's main calendar, with selection of an eligible shared calendar available in English. See https://support.google.com/googlehome/answer/7029002.

1. On a dedicated test Google account, connect Google Calendar in FamOS and select the calendar to sync. Verify its sharing setting before using household data.
2. In Google Home, link the same Google account and enable personal results/Voice Match as appropriate. Confirm which calendar is used for event creation. Use a test calendar and non-sensitive event names.
3. Say “Hey Google, add a test appointment to my calendar tomorrow at 3 PM.” Confirm the title, time and calendar in Google Calendar.
4. Run FamOS calendar sync and confirm the event appears once, with the correct local time and intended visibility. Record the speaker model, language, timezone, sync delay, and any warning or error.
5. Repeat for an all-day event and an event created in the FamOS-selected shared calendar. If the voice assistant cannot write to that calendar, document the limitation rather than implying direct creation in FamOS.
6. Delete only the explicitly created test events after the test.

A connected account, speaker/display and working calendar synchronization are prerequisites. Do not ask users to bypass Google's unverified-app warning. Android App Actions are a separate phone integration and require an Android app build, registered deep links and Google Assistant testing before release.
