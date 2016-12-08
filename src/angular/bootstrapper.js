/*
    Extending 2sxc with angular capabilities
    In general, this should automatically take care of everything just by including it in your sources. 
    Make sure it's added after AngularJS and after the 2sxc.api.js
    It will then look for all sxc-apps and initialize them, ensuring that $http is pre-configured to work with DNN

    Required HTML Attributes 
    * sxc-app="MyAppNameWhatever" - required for auto-bootstrapping
    
    Optional HTML Attributes
    * ng-controller="AngularControllerName" - required for auto-bootstrapping
    * dependencies="" - here you can add additional dependencies if you need them
    * id, data-instanceid, app-instanceid - would tell 2sxc what module-id to use, for example when doing server requests
    *   Note that the id etc. are optional, because since 2sxc 8.x it can be auto-detected
    * data-cb-id - the content-block id, only used for advanced use cases and is normally auto-detected
    
    Angular Constants / Variables added
    * AppInstanceId - the module-id for accessing the HTML-block or for server-requests
    * ContentBlockId - advanced use case, not explained here
    * AppServiceFramework - a real or fake DNN sf-object
    * HttpHeaders - the headers which we use to initialize the $http to ensure it works / authenticates correctly
    
    Angular Modules added
    * 2sxc4ng
    * all the dependencies listed in the dependencies attribute
*/

(function(angular) {
    var ng = $2sxc.ng = {
        appAttribute: "sxc-app",
        ngAttrPrefixes: ["ng-", "data-ng-", "ng:", "x-ng-"],
        iidAttrNames: ["app-instanceid", "data-instanceid", "id"],
        cbidAttrName: "data-cb-id",
        ngAttrDependencies: "dependencies",

        // bootstrap: an App-Start-Help; normally you won't call this manually as it will be auto-bootstrapped. 
        // All params optional except for 'element'
        bootstrap: function(element, ngModName, iid, dependencies, config) {
            // first, try to get moduleId from function-param or from from URL
            iid = iid || ng.findInstanceId(element) || $2sxc.urlParams.get("mid");

            var cbid = ng.findContentBlockId(element) || $2sxc.urlParams.get("cbid") || iid;
            // then provide access to the dnn-services framework (or a fake thereof)
            var sf = $.ServicesFramework(iid);

            // create a micro-module to configure sxc-init parameters, add to dependencies. Note that the order is important!
            var confMod = angular.module("confSxcApp" + iid + "-" + cbid, [])
                .constant("AppInstanceId", iid)
                .constant("ContentBlockId", cbid)
                .constant("AppServiceFramework", sf)
                .constant("HttpHeaders", {
                    "ModuleId": iid,
                    "ContentBlockId": cbid,
                    "TabId": sf.getTabId(),
                    "RequestVerificationToken": sf.getAntiForgeryValue(),
                    "Debugging-Hint": "bootstrapped by 2sxc4ng",
                    "Cache-Control": "no-cache", // had to add because of browser ajax caching issue #437
                    "Pragma": "no-cache"
                });
            var allDependencies = [confMod.name, "2sxc4ng"].concat(dependencies || [ngModName]);

            angular.element(document).ready(function() {
                try {
                    angular.bootstrap(element, allDependencies, config); // start the app
                } catch (e) { // Make sure that if one app breaks, others continue to work
                    if (console && console.error)
                        console.error(e);
                }
            });
        },

        // find instance Id in an attribute of the tag - typically with id="app-700" or something and use the number as IID
        // if it doesn't find a manual value, it will auto-detect using the $2sxc-context
        findInstanceId: function findInstanceId(element) {
            var attrib, ngElement = angular.element(element), iid;
            // first: check if an ID was specifically provided by the programmer in one of the given attributes
            for (var i = 0; i < ng.iidAttrNames.length; i++) {
                attrib = ngElement.attr(ng.iidAttrNames[i]);
                if (attrib) {
                    iid = parseInt(attrib.toString().replace(/\D/g, "")); // filter all characters if necessary
                    if (iid) return iid; // stop if found
                }
            }

            // if we get here, it was not manually provided so use auto-detect
            var sxc = $2sxc(element);
            iid = sxc && sxc.id; // null or a number

            // if still not found throw error
            if (!iid)
                throw "iid or instanceId (the DNN moduleid) not supplied and automatic lookup failed. Please set app-tag attribute iid or give id in bootstrap call";
            return iid;
        },

        findContentBlockId: function(el) {
            var cbid;
            while (el.getAttribute) { // loop as long as it knows this command
                if ((cbid = el.getAttribute(ng.cbidAttrName))) return cbid;
                el = el.parentNode;
            }
            return null;
        },

        // Auto-bootstrap all sub-tags having an 'sxc-app' attribute - for Multiple-Apps-per-Page
        bootstrapAll: function bootstrapAll(element) {
            element = element || document;
            var allAppTags = element.querySelectorAll("[" + ng.appAttribute + "]");
            angular.forEach(allAppTags, function(appTag) {
                var ngModName = appTag.getAttribute(ng.appAttribute);
                var configDependencyInjection = { strictDi: ng.getNgAttribute(appTag, "strict-di") !== null };

                var dependencies = ng.getNgAttribute(appTag, ng.ngAttrDependencies);
                if (dependencies) dependencies = dependencies.split(",");
                ng.bootstrap(appTag, ngModName, null, dependencies, configDependencyInjection);
            });
        },

        // if the page contains angular, do auto-bootstrap of all 2sxc apps
        autoRunBootstrap: function autoRunBootstrap() {
            // prevent multiple bootstrapping in case this file was included multiple times
            if (window.bootstrappingAlreadyStarted)
                return;
            window.bootstrappingAlreadyStarted = true;

            // bootstrap, if it has angular
            if (angular)
                angular.element(document).ready(function() {
                    ng.bootstrapAll();
                });
        },

        // Helper function to try various attribute-prefixes
        getNgAttribute: function getNgAttribute(element, ngAttr) {
            var attr, i, ii = ng.ngAttrPrefixes.length;
            element = angular.element(element);
            for (i = 0; i < ii; ++i) {
                attr = ng.ngAttrPrefixes[i] + ngAttr;
                if (typeof (attr = element.attr(attr)) == "string")
                    return attr;
            }
            return null;
        }
    };

    ng.autoRunBootstrap();

})(angular);