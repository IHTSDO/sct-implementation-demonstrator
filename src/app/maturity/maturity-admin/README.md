# Maturity Assessment Admin Component

## Overview
The Maturity Admin Component provides administrative functionality for managing maturity assessment responses. This component is designed for booth administrators who need to review and delete assessment responses in case of errors or unwanted submissions.

## Features
- **List All Assessments**: View all maturity assessment responses filtered by event
- **Real-time Updates**: Automatically updates when new assessments are added or existing ones are modified
- **Event Filtering**: Filter assessments by event name (e.g., "Expo 2025")
- **Delete Functionality**: Remove unwanted or erroneous assessment responses
- **Detailed View**: Display comprehensive information including:
  - Assessment name and author
  - System name and timestamp
  - Maturity level and overall score
  - Location information
  - Stakeholder type

## Access
The admin component is accessible at: `/maturity/admin`

## Usage

### Viewing Assessments
1. Navigate to `/maturity/admin`
2. Select an event from the dropdown (defaults to "Expo 2025")
3. View the list of assessments in the table

### Deleting Assessments
1. Locate the assessment you want to delete in the table
2. Click the red delete button (🗑️) in the Actions column
3. Confirm the deletion in the popup dialog
4. The assessment will be permanently removed from the database

## Security Considerations
- This component provides administrative access to delete data
- Use with caution as deletions are permanent
- Intended for booth administrators only
- Consider implementing additional authentication if needed

## Technical Details
- Built with Angular Material for consistent UI
- Uses Firebase Firestore for data storage
- Real-time updates via Firestore listeners
- Responsive design for various screen sizes

## Component Structure
```
maturity-admin/
├── maturity-admin.component.ts    # Main component logic
├── maturity-admin.component.html  # Template with Material table
├── maturity-admin.component.css   # Styling and responsive design
├── maturity-admin.component.spec.ts # Unit tests
└── README.md                      # This documentation
```
