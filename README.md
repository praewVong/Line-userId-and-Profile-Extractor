# Line-userId-and-Profile-Extractor

An automated LINE follower profile extraction tool built with Google Apps Script, LINE Messaging API, and Google Sheets.

## Overview

LINE Friend Profile Extractor automates the collection of follower profile information from a LINE Official Account.

The system retrieves follower IDs, checks existing records, extracts new profile information, and automatically appends the results to Google Sheets.

It is designed to reduce repetitive API requests and prevent duplicate records through incremental data extraction.

## Key Features

- **Automated Data Extraction** – Retrieves follower IDs and profile information through the LINE Messaging API.
- **Incremental Extraction** – Identifies new followers by comparing their User IDs against existing spreadsheet records.
- **Duplicate Prevention** – Prevents previously recorded profiles from being retrieved and appended again.
- **Batch Processing** – Processes multiple profile requests simultaneously.
- **Retry Mechanism** – Automatically retries requests when encountering selected temporary HTTP errors.
- **Customizable Extraction Limit** – Allows users to specify the maximum number of successfully retrieved new profiles per execution.
- **Automatic Data Appending** – Adds new records without overwriting existing spreadsheet data.

## Technologies Used

- JavaScript
- Google Apps Script
- LINE Messaging API
- Google Sheets

## How It Works

1. Open the Google Spreadsheet.
2. Select the LINE menu.
3. Choose "Get Friend's Profiles".
4. Enter a Channel Access Token.
5. Specify the maximum number of new profiles to retrieve.
6. Retrieve follower IDs using API pagination.
7. Compare retrieved IDs against existing spreadsheet records.
8. Extract profile information for new users in batches.
9. Append successfully retrieved profiles to Google Sheets.

## Data Structure

| Column | Field |
|---|---|
| A | User ID |
| B | Display Name |
| C | Picture URL |
| D | Status Message |

## Incremental Extraction Logic

The system uses existing User IDs as reference data to identify new followers.

For each execution:

- Existing records are preserved.
- Previously retrieved User IDs are skipped.
- Only new profiles are requested.
- Successfully retrieved profiles are appended to the spreadsheet.

If an execution stops before completing the extraction, running it again will skip records that were successfully saved and continue searching for new profiles.

## Setup

1. Create a Google Spreadsheet.
2. Open Extensions → Apps Script.
3. Add the source code.
4. Save and reload the spreadsheet.
5. Select the LINE menu to start extraction.
6. Authorize the required permissions.

## Requirements

- Google account with Google Sheets access.
- LINE Official Account.
- LINE Messaging API channel.
- Valid Channel Access Token.
- Verified or Premium LINE Official Account for the follower ID retrieval endpoint.

## Security & Privacy

- Never expose Channel Access Tokens in public repositories.
- Do not publish real follower information or personal data.
- Use appropriate authorization when accessing profile information.
- Store extracted data securely.

## Processing Limits & Performance

### API Request Limits

- **Follower ID Retrieval:** LINE Messaging API allows a maximum of 1,000 user IDs per request.
- **Pagination:** The system uses pagination to retrieve additional follower IDs beyond the first page.
- **Profile Retrieval:** Each user's profile is retrieved through an individual API request.
- **Batch Processing:** Profile requests are processed in batches of 30 users per batch.

### Execution Limits

Google Apps Script has a maximum execution time of 6 minutes per execution.

Although the system supports retrieving more than 1,000 followers through pagination, the actual number of profiles processed per execution depends on API response times, network latency, retry attempts, and script execution limits.

The extraction limit is configurable, allowing users to control the number of new profiles retrieved in each run.

**Recommended starting point:** 300–500 new profiles per execution, subject to testing and runtime conditions.

### Data Continuity

If an execution stops before completing, users can run the script again.

The system checks existing User IDs and skips successfully saved records, reducing duplicate API requests and preventing duplicate entries in Google Sheets.

### References

- [LINE Messaging API Reference](https://developers.line.biz/en/reference/messaging-api/#get-follower-ids)
- [Google Apps Script Quotas](https://developers.google.com/apps-script/guides/services/quotas)


## Future Improvements

- Persistent execution checkpoints.
- Improved API rate-limit management.
- Automated scheduling.
- Extraction progress dashboard.
- Configurable export destinations.

## Project Purpose

This project demonstrates practical applications of API integration, data automation, batch processing, and incremental data management using Google Apps Script.

