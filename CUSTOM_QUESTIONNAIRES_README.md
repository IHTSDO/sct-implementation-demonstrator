# Custom Questionnaires - User Guide

## Overview

The Clinical Forms component now supports uploading and managing custom FHIR Questionnaire resources. This feature allows you to dynamically add questionnaires without modifying the application code.

## Features

✅ **Upload FHIR Questionnaires**: Upload any valid FHIR Questionnaire resource in JSON format
✅ **localStorage Persistence**: Questionnaires are stored in the browser's localStorage (available to all patients)
✅ **Easy Management**: View, use, and delete custom questionnaires through a dedicated management interface
✅ **Seamless Integration**: Custom questionnaires appear alongside built-in forms in the form selector

## How to Use

### 1. Accessing the Management Interface

1. Navigate to the **Clinical Forms** section
2. Click on the **"Manage Questionnaires"** tab
3. You will see two sections:
   - **Upload New Questionnaire**: For adding new questionnaires
   - **Uploaded Questionnaires**: List of all custom questionnaires

### 2. Uploading a Custom Questionnaire

1. Click the **"Choose File"** button
2. Select a JSON file containing a valid FHIR Questionnaire resource
3. The system will:
   - Validate that it's a proper FHIR Questionnaire (resourceType must be "Questionnaire")
   - Check for duplicates
   - Store it in localStorage
   - Display a success or error message

**Requirements for the JSON file:**
- Must be a valid JSON file
- Must have `"resourceType": "Questionnaire"`
- Should include a `title` or `name` field
- Should include a `description` field (optional but recommended)

### 3. Using a Custom Questionnaire

**Option 1: From the Manage Tab**
1. In the "Uploaded Questionnaires" list, find your questionnaire
2. Click the **"Use Form"** button
3. You'll be automatically redirected to the Data Entry tab with the form loaded

**Option 2: From the Data Entry Tab**
1. Go to the **"Data Entry"** tab
2. Open the form selector dropdown
3. Look for the **"Custom Questionnaires"** section
4. Select your questionnaire
5. Fill out and submit the form

### 4. Deleting Custom Questionnaires

**Delete Individual Questionnaire:**
1. In the "Uploaded Questionnaires" list, find the questionnaire you want to delete
2. Click the **"Delete"** button
3. Confirm the deletion

**Delete All Questionnaires:**
1. Click the **"Delete All"** button at the top of the list
2. Confirm the deletion (this action cannot be undone)

## Example Questionnaire

An example custom questionnaire is provided at:
```
src/assets/questionnaires/example-custom-questionnaire.json
```

This example demonstrates:
- Basic question types (string, date, choice, boolean, text, integer)
- Question groups
- SNOMED CT terminology bindings
- Required and optional fields
- Single and multiple choice questions

You can use this file to test the upload functionality.

## Technical Details

### Storage

- **Location**: Browser localStorage
- **Key**: `custom-questionnaires`
- **Scope**: Application-wide (not patient-specific)
- **Format**: JSON array of custom questionnaire objects

### Data Structure

Each custom questionnaire is stored with:
```typescript
{
  id: string,              // Auto-generated unique ID
  name: string,            // From questionnaire.title or questionnaire.name
  description: string,     // From questionnaire.description
  category: string,        // Always "Custom Questionnaires"
  data: any,              // The full FHIR Questionnaire resource
  uploadedDate: string    // ISO timestamp
}
```

### Validation

The system validates:
1. File is valid JSON
2. `resourceType` is exactly "Questionnaire"
3. No duplicate questionnaires (by ID or URL)
4. File can be successfully parsed

### Integration

Custom questionnaires are:
- Rendered using the same `questionnaire-form` component as built-in questionnaires
- Stored with the same format as other questionnaire responses
- Listed in the Form Records tab alongside other submissions

## Troubleshooting

### Upload Fails

**"Invalid FHIR Questionnaire"**
- Ensure the JSON has `"resourceType": "Questionnaire"`
- Verify the JSON structure follows FHIR R4 Questionnaire specification

**"A questionnaire with this ID or URL already exists"**
- A questionnaire with the same `id` or `url` is already uploaded
- Either use the existing one or modify the ID/URL in your JSON file

**"Invalid JSON file"**
- The file is not valid JSON
- Check for syntax errors using a JSON validator

### Questionnaire Not Appearing

- Check localStorage is enabled in your browser
- Ensure the questionnaire was uploaded successfully (look for success message)
- Try refreshing the page

### Responses Not Saving

- Custom questionnaire responses are handled the same way as built-in questionnaires
- Check the Form Records tab to see submitted responses
- Responses are associated with the patient in context

## Browser Compatibility

This feature requires:
- localStorage support (all modern browsers)
- FileReader API (all modern browsers)
- ES6+ JavaScript features

## Limitations

1. **No Server Persistence**: Questionnaires are stored only in the browser's localStorage
   - Clearing browser data will delete all custom questionnaires
   - Questionnaires are not shared across different browsers/devices

2. **File Size**: Very large questionnaires may hit localStorage size limits (typically 5-10MB per domain)

3. **FHIR Version**: Designed for FHIR R4 Questionnaires

4. **No Validation of Question Types**: The system accepts any valid FHIR Questionnaire structure, but the UI may not support all advanced FHIR features

## Best Practices

1. **Backup Your Questionnaires**: Keep the original JSON files in a safe location
2. **Use Descriptive Names**: Give your questionnaires clear, descriptive titles
3. **Include Descriptions**: Add meaningful descriptions to help users understand the questionnaire's purpose
4. **Test Before Production**: Upload and test questionnaires with sample data before using with real patients
5. **Use SNOMED CT**: Include proper SNOMED CT bindings for terminology standardization

## Future Enhancements

Potential future improvements:
- Export custom questionnaires
- Import/Export all questionnaires as a bundle
- Server-side storage and synchronization
- Questionnaire versioning
- Share questionnaires between team members
- Advanced questionnaire editor

## Support

For issues or questions, please refer to the main project documentation or contact the development team.

