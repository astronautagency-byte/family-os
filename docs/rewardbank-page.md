# RewardBank page

## Stars and experiences

RewardBank now displays stars instead of points, with the same numerical balances (1 existing point = 1 star). The database/API points field is intentionally unchanged to preserve the ledger and approval safeguards. Parents choose a custom chore star value or a 1/3/5-star shortcut, and set the star cost of each new experience. New rewards use the experience type; existing purchase/cash rewards remain available. No money is transferred by FamOS.

RewardBank is now available at /rewards, from Rewards in desktop navigation or More → Rewards on mobile. Tasks no longer opens a RewardBank modal.

Household owners keep enrollment, scoring, approval, reward creation, and fulfillment controls. Other members see their own balance, earning plan, reward requests, and history.

Members whose saved member profile type is child receive four navigation destinations: Calendar, Tasks, Rewards, and Chat. Restricted application tabs redirect to Tasks, including direct links and browser history navigation. Owners retain the full experience. Child navigation has no global AI, settings, or quick-add menu; page-specific controls remain available.

This is a profile-based UI experience, not a new server authorization boundary. Existing RewardBank RLS and owner-only command checks remain authoritative. Changing a member's profile type is not equivalent to a parent-enforced account lock.

Test with separate owner and child logins. On the owner account enable RewardBank, enroll the child, assign a task in Tasks, score it in Rewards, and create a reward. On the child account complete the task, then approve its points as owner. Request the reward as child and fulfill or decline it as owner. Verify the balance persists after refresh and repeated approval does not award twice. Verify /settings redirects to /tasks for a saved child profile.
