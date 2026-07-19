# Loop App Updates

## Added

- Added date picker support in todo item due-time submenu.
- Added a lightweight calendar unscheduled task assignment button.
- Added formatted due date label display for todo badges.

## Files changed

- `renderer.js`

## Notes

- The new `Assign to <date>` button in calendar unscheduled tasks sets `dueTime` to an ISO date string.
- `parseTodoItemDueDate()` now supports direct `YYYY-MM-DD` input.