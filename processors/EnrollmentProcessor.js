//
// Welcome to the annotated FaceTec Device SDK core code for performing secure Enrollment.
//
//
// This is an example self-contained class to perform Enrollment with the FaceTec SDK.
// You may choose to further componentize parts of this in your own Apps based on your specific requirements.
//
var EnrollmentProcessor = /** @class */ (function () {
    function EnrollmentProcessor(sessionToken, sampleAppControllerReference) {
        var _this = this;
        this.latestNetworkRequest = new XMLHttpRequest();
        //
        // Part 2:  Handling the Result of a FaceScan
        //
        this.processSessionResultWhileFaceTecSDKWaits = function (sessionResult, faceScanResultCallback) {
            _this.latestSessionResult = sessionResult;
            //
            // Part 3:  Handles early exit scenarios where there is no FaceScan to handle -- i.e. User Cancellation, Timeouts, etc.
            //
            if (sessionResult.status !== FaceTecSDK.FaceTecSessionStatus.SessionCompletedSuccessfully) {
                _this.latestNetworkRequest.abort();
                faceScanResultCallback.cancel();
                return;
            }
            // IMPORTANT:  FaceTecSDK.FaceTecSessionStatus.SessionCompletedSuccessfully DOES NOT mean the Enrollment was Successful.
            // It simply means the User completed the Session and a 3D FaceScan was created.  You still need to perform the Enrollment on your Servers.
            //
            // Part 4:  Get essential data off the FaceTecSessionResult
            //
            var parameters = {
                faceScan: sessionResult.faceScan,
                auditTrailImage: sessionResult.auditTrail[0],
                lowQualityAuditTrailImage: sessionResult.lowQualityAuditTrail[0],
                sessionId: sessionResult.sessionId,
                externalDatabaseRefID: _this.sampleAppControllerReference.getLatestEnrollmentIdentifier()
            };
            //
            // Part 5:  Make the Networking Call to Your Servers.  Below is just example code, you are free to customize based on how your own API works.
            //
            _this.latestNetworkRequest = new XMLHttpRequest();
            _this.latestNetworkRequest.open("POST", Config.BaseURL + "/enrollment-3d");
            _this.latestNetworkRequest.setRequestHeader("Content-Type", "application/json");
            _this.latestNetworkRequest.setRequestHeader("X-Device-Key", Config.DeviceKeyIdentifier);
            _this.latestNetworkRequest.setRequestHeader("X-User-Agent", FaceTecSDK.createFaceTecAPIUserAgentString(sessionResult.sessionId));
            _this.latestNetworkRequest.onreadystatechange = function () {
                //
                // Part 6:  In our Sample, we evaluate a boolean response and treat true as was successfully processed and should proceed to next step,
                // and handle all other responses by cancelling out.
                // You may have different paradigms in your own API and are free to customize based on these.
                //
                if (_this.latestNetworkRequest.readyState === XMLHttpRequest.DONE) {
                    try {
                        var responseJSON = JSON.parse(_this.latestNetworkRequest.responseText);
                        var scanResultBlob = responseJSON.scanResultBlob;
                        // In v9.2.0+, we key off a new property called wasProcessed to determine if we successfully processed the Session result on the Server.
                        // Device SDK UI flow is now driven by the proceedToNextStep function, which should receive the scanResultBlob from the Server SDK response.
                        if (responseJSON.wasProcessed === true && responseJSON.error === false) {
                            // Demonstrates dynamically setting the Success Screen Message.
                            FaceTecSDK.FaceTecCustomization.setOverrideResultScreenSuccessMessage("Face Scanned\n3D Liveness Proven");
                            // In v9.2.0+, simply pass in scanResultBlob to the proceedToNextStep function to advance the User flow.
                            // scanResultBlob is a proprietary, encrypted blob that controls the logic for what happens next for the User.
                            faceScanResultCallback.proceedToNextStep(scanResultBlob);
                            _this.callData = responseJSON.callData;
                        }
                        else {
                            // CASE:  UNEXPECTED response from API.  Our Sample Code keys off a wasProcessed boolean on the root of the JSON object --> You define your own API contracts with yourself and may choose to do something different here based on the error.
                            if (responseJSON.error === true && responseJSON.errorMessage != null) {
                                _this.cancelDueToNetworkError(responseJSON.errorMessage, faceScanResultCallback);
                            }
                            else {
                                _this.cancelDueToNetworkError("Unexpected API response, cancelling out.", faceScanResultCallback);
                            }
                        }
                    }
                    catch (_e) {
                        // CASE:  Parsing the response into JSON failed --> You define your own API contracts with yourself and may choose to do something different here based on the error.  Solid server-side code should ensure you don't get to this case.
                        _this.cancelDueToNetworkError("Exception while handling API response, cancelling out.", faceScanResultCallback);
                    }
                }
            };
            _this.latestNetworkRequest.onerror = function () {
                // CASE:  Network Request itself is erroring --> You define your own API contracts with yourself and may choose to do something different here based on the error.
                _this.cancelDueToNetworkError("XHR error, cancelling.", faceScanResultCallback);
            };
            //
            // Part 7:  Demonstrates updating the Progress Bar based on the progress event.
            //
            _this.latestNetworkRequest.upload.onprogress = function (event) {
                var progress = event.loaded / event.total;
                faceScanResultCallback.uploadProgress(progress);
            };
            //
            // Part 8:  Actually send the request.
            //
            var jsonStringToUpload = JSON.stringify(parameters);
            _this.latestNetworkRequest.send(jsonStringToUpload);
            //
            // Part 9:  For better UX, update the User if the upload is taking a while.  You are free to customize and enhance this behavior to your liking.
            //
            window.setTimeout(function () {
                if (_this.latestNetworkRequest.readyState === XMLHttpRequest.DONE) {
                    return;
                }
                faceScanResultCallback.uploadMessageOverride("Still Uploading...");
            }, 6000);
        };
        //
        // Part 10:  This function gets called after the FaceTec SDK is completely done.  There are no parameters because you have already been passed all data in the processSessionWhileFaceTecSDKWaits function and have already handled all of your own results.
        //
        this.onFaceTecSDKCompletelyDone = function () {
            //
            // DEVELOPER NOTE:  onFaceTecSDKCompletelyDone() is called after you signal the FaceTec SDK with success() or cancel().
            // Calling a custom function on the Sample App Controller is done for demonstration purposes to show you that here is where you get control back from the FaceTec SDK.
            //
            _this.success = _this.latestSessionResult.isCompletelyDone;
            // Log success message
            if (_this.success) {
                DeveloperStatusMessages.logMessage("Liveness-proven Face Verified");
            }
            // If enrollment was not successful, clear the enrollment identifier
            else {
                _this.sampleAppControllerReference.clearLatestEnrollmentIdentifier();
            }
            _this.sampleAppControllerReference.onComplete(_this.latestSessionResult, _this.callData, null, _this.latestNetworkRequest.status);
        };
        // Helper function to ensure the session is only cancelled once
        this.cancelDueToNetworkError = function (networkErrorMessage, faceScanResultCallback) {
            if (_this.cancelledDueToNetworkError === false) {
                console.error(networkErrorMessage);
                _this.cancelledDueToNetworkError = true;
                faceScanResultCallback.cancel();
            }
        };
        //
        // DEVELOPER NOTE:  This public convenience method is for demonstration purposes only so the Sample App can get information about what is happening in the processor.
        // In your code, you may not even want or need to do this.
        //
        this.isSuccess = function () {
            return _this.success;
        };
        //
        // DEVELOPER NOTE:  These properties are for demonstration purposes only so the Sample App can get information about what is happening in the processor.
        // In the code in your own App, you can pass around signals, flags, intermediates, and results however you would like.
        //
        this.success = false;
        this.sampleAppControllerReference = sampleAppControllerReference;
        this.latestSessionResult = null;
        this.callData = null;
        this.cancelledDueToNetworkError = false;
        //
        // Part 1:  Starting the FaceTec Session
        //
        // Required parameters:
        // - FaceTecFaceScanProcessor:  A class that implements FaceTecFaceScanProcessor, which handles the FaceScan when the User completes a Session.  In this example, "this" implements the class.
        // - sessionToken:  A valid Session Token you just created by calling your API to get a Session Token from the Server SDK.
        //
        new FaceTecSDK.FaceTecSession(this, sessionToken);
    }
    return EnrollmentProcessor;
}());
var EnrollmentProcessor = EnrollmentProcessor;
