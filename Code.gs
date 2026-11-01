/**
 * LINE Friend Profile Extractor
 * Incremental extraction with duplicate prevention.
 */

const CONFIG = {
  FOLLOWERS_URL: 'https://api.line.me/v2/bot/followers/ids',
  PROFILE_URL: 'https://api.line.me/v2/bot/profile/',
  BATCH_SIZE: 30,
  PAGE_SIZE: 1000,
  DELAY_MS: 300,
  MAX_RETRY: 3,
  HEADERS: ['User ID', 'Display Name', 'Picture URL', 'Status Message']
};


// 1. Create custom menu
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('LINE')
    .addItem("Get Friend's Profiles", 'getFriends')
    .addToUi();
}


// 2. Get user input
function getFriends() {
  const ui = SpreadsheetApp.getUi();

  const tokenResponse = ui.prompt(
    'Channel Access Token',
    'Enter your LINE Channel Access Token:',
    ui.ButtonSet.OK_CANCEL
  );

  if (tokenResponse.getSelectedButton() !== ui.Button.OK) return;

  const token = tokenResponse.getResponseText().trim();

  if (!token) {
    ui.alert('Please enter a valid Channel Access Token.');
    return;
  }

  const limitResponse = ui.prompt(
    'Maximum New Profiles',
    'Enter the number of new profiles to retrieve.\nLeave blank to retrieve all new profiles.',
    ui.ButtonSet.OK_CANCEL
  );

  if (limitResponse.getSelectedButton() !== ui.Button.OK) return;

  const input = limitResponse.getResponseText().trim();
  const limit = input === '' ? Infinity : Number(input);

  if (limit !== Infinity &&
      (!Number.isInteger(limit) || limit <= 0)) {
    ui.alert('Please enter a valid positive number.');
    return;
  }

  getFriendsFromLINE(token, limit);
}


// 3. Fetch requests with retry mechanism
function fetchWithRetry(requests, maxRetry = CONFIG.MAX_RETRY) {
  let results = UrlFetchApp.fetchAll(requests);

  for (let attempt = 0; attempt < maxRetry; attempt++) {
    const failedIndexes = [];

    results.forEach((response, index) => {
      const code = response.getResponseCode();

      if ([429, 500, 502, 503, 504].includes(code)) {
        failedIndexes.push(index);
      }
    });

    if (failedIndexes.length === 0) break;

    Logger.log(
      'Retry attempt ' + (attempt + 1) +
      ': ' + failedIndexes.length + ' failed requests'
    );

    Utilities.sleep(1000 * (attempt + 1));

    const failedRequests = failedIndexes.map(
      index => requests[index]
    );

    const retried = UrlFetchApp.fetchAll(failedRequests);

    failedIndexes.forEach((index, i) => {
      results[index] = retried[i];
    });
  }

  return results;
}


// 4. Get existing User IDs from Google Sheets
function getExistingUserIds(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return new Set();

  const values = sheet
    .getRange(2, 1, lastRow - 1, 1)
    .getValues();

  return new Set(
    values
      .flat()
      .filter(id => id !== '')
      .map(String)
  );
}


// 5. Get a page of follower IDs
function getFollowersPage(token, cursor) {
  let url = CONFIG.FOLLOWERS_URL +
    '?limit=' + CONFIG.PAGE_SIZE;

  if (cursor) {
    url += '&start=' + encodeURIComponent(cursor);
  }

  const response = fetchWithRetry([{
    url: url,
    headers: {
      Authorization: 'Bearer ' + token
    },
    muteHttpExceptions: true
  }])[0];

  if (response.getResponseCode() !== 200) {
    throw new Error(
      'LINE Followers API error: HTTP ' +
      response.getResponseCode()
    );
  }

  return JSON.parse(response.getContentText());
}


// 6. Get profile information in batches
function getProfiles(userIds, token) {
  const requests = userIds.map(id => ({
    url: CONFIG.PROFILE_URL + encodeURIComponent(id),
    headers: {
      Authorization: 'Bearer ' + token
    },
    muteHttpExceptions: true
  }));

  const results = fetchWithRetry(requests);

  const profileData = [];

  results.forEach(response => {
    const code = response.getResponseCode();

    if (code !== 200) {
      Logger.log('Profile request failed: HTTP ' + code);
      return;
    }

    try {
      const profile = JSON.parse(response.getContentText());

      if (profile.userId) {
        profileData.push([
          profile.userId,
          profile.displayName || '',
          profile.pictureUrl || '',
          profile.statusMessage || ''
        ]);
      }

    } catch (error) {
      Logger.log('Profile parsing error: ' + error.message);
    }
  });

  return profileData;
}


// 7. Main incremental extraction function
function getFriendsFromLINE(token, limit) {
  const lock = LockService.getDocumentLock();

  if (!lock.tryLock(1000)) {
    SpreadsheetApp.getUi().alert(
      'Another extraction process is already running.'
    );
    return;
  }

  try {
    const sheet = SpreadsheetApp
      .getActiveSpreadsheet()
      .getActiveSheet();

    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, 4)
        .setValues([CONFIG.HEADERS]);
    }

    const existingIds = getExistingUserIds(sheet);
    const initialCount = existingIds.size;
    const checkedIds = new Set();
    const seenCursors = new Set();

    let cursor = null;
    let addedCount = 0;

    Logger.log('Existing users: ' + initialCount);

    while (true) {
      const page = getFollowersPage(token, cursor);

      const newIds = page.userIds.filter(id =>
        !existingIds.has(id) && !checkedIds.has(id)
      );

      // Process new IDs until the successful profile limit is reached
      for (let i = 0;
           i < newIds.length && addedCount < limit;
           i += CONFIG.BATCH_SIZE) {

        const batch = newIds.slice(
          i,
          i + CONFIG.BATCH_SIZE
        );

        batch.forEach(id => checkedIds.add(id));

        const profileData = getProfiles(batch, token);

        if (profileData.length > 0) {
          const startRow = sheet.getLastRow() + 1;

          sheet.getRange(
            startRow,
            1,
            profileData.length,
            4
          ).setValues(profileData);

          profileData.forEach(row =>
            existingIds.add(row[0])
          );

          addedCount += profileData.length;
        }

        Logger.log(
          'Profiles added: ' + addedCount + '/' + limit
        );

        if (addedCount < limit) {
          Utilities.sleep(CONFIG.DELAY_MS);
        }
      }

      if (addedCount >= limit) break;

      if (!page.next) break;

      if (seenCursors.has(page.next)) {
        throw new Error('Repeated pagination cursor detected.');
      }

      seenCursors.add(page.next);
      cursor = page.next;
    }

    SpreadsheetApp.getUi().alert(
      'Extraction completed!\n\n' +
      'Existing profiles before run: ' + initialCount + '\n' +
      'New profiles added: ' + addedCount + '\n' +
      'Total profiles: ' + existingIds.size
    );

  } catch (error) {
    Logger.log('Extraction error: ' + error.message);

    SpreadsheetApp.getUi().alert(
      'Extraction failed:\n' + error.message
    );

  } finally {
    lock.releaseLock();
  }
}
