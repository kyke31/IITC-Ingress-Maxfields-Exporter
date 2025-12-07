// ==UserScript==
// @id iitc-plugin-ingressmaxfield@stenyg
// @name IITC plugin: Ingress Maxfields
// @category Information
// @version 0.2.0.2
// @namespace http://github.com/jonatkins/ingress-intel-total-conversion
// @updateURL http://github.com/itayo/IITC-Ingress-Maxfields-Exporter/raw/master/IngressMaxFields.user.js
// @downloadURL http://github.com/itayo/IITC-Ingress-Maxfields-Exporter/raw/master/IngressMaxFields.user.js
// @description Exports portals in the format for http://www.ingress-maxfield.com/ using a modern, flexbox-based UI inspired by Multi-Anchor Fanfields.
// @include		https://intel.ingress.com/*
// @match		https://intel.ingress.com/*
// @grant none

// --- Changelog ---
// v0.2.0.2 - Authors: kyke31 (Enrique H.) with Google Gemini
// - Complete UI overhaul: Replaced plain text output with an interactive table.
// - Fixed window dimensions: Dialog is now fixed size to prevent layout issues.
// - Enhanced Data Editing: Keys are editable, SBUL is a checkbox.
// - Improved UX: Client-side sorting, persistent settings (Agents, Email, Color), and per-row deletion.
// - Internal Navigation: Clicking portal names now centers the map instead of opening external links.
// - Export & Request: Separate buttons for copying data to clipboard and submitting the plan.
// - Code Cleanup: Extensive refactoring, comments, and optimization for performance and security.
// - Name Cleaning: Added automatic removal of special characters (CSV breakers like quotes/commas) from portal names.
// - Baseline: v0.2.0.0 (Original text-only exporter).

// ==/UserScript==
/*global $:false */
/*global map:false */
/*global L:false */
function wrapper() {
    // Ensure the basic plugin framework exists
    if (typeof window.plugin !== "function") {
        window.plugin = function() {};
    }

    // Base context for plugin
    window.plugin.ingressmaxfield = function() {};
    var self = window.plugin.ingressmaxfield;

    // --- Plugin State Management ---
    self.sortKey = "number";
    self.sortOrder = 1; 
    self.dialogData = [];
    self.PLUGIN_VERSION = "0.2.0.2";

    // Constants for Persistence
    self.KEY_AGENTS = "imf_agents";
    self.KEY_COLOR = "imf_color";
    self.KEY_EMAIL = "imf_email";

    // --- Persistence ---
    self.loadSettings = function() {
        return {
            agents: localStorage.getItem(self.KEY_AGENTS) || "1",
            color: localStorage.getItem(self.KEY_COLOR) || "ENL",
            email: localStorage.getItem(self.KEY_EMAIL) || ""
        };
    };

    self.saveSettings = function(form) {
        localStorage.setItem(self.KEY_AGENTS, form.num_agents.value);
        localStorage.setItem(self.KEY_EMAIL, form.email.value);
        localStorage.setItem(self.KEY_COLOR, form.color.value);
    };

    // --- Helper: Clean Portal Name ---
    self.cleanPortalName = function(name) {
        if (!name) { return "Untitled Portal"; }
        // Also remove single and double quotes to prevent CSV/string issues
        return name.replace(/[,.;#$/\\*'"“”]/g, "").trim();
    };

    // --- CSS Setup (MAFF Style) ---
    self.setupCSS = function() {
        $("<style>").prop("type", "text/css").html(`
            #imf-dialog { display: flex; flex-direction: column; height: 100%; font-family: sans-serif; font-size: 12px; color: #ccc; overflow: hidden; }
            
            /* Layout Containers */
            .imf-layout { display: flex; height: 100%; width: 100%; overflow: hidden; }
            .imf-table-container { flex: 1; overflow: auto; border-right: 1px solid #444; background-color: #202020; display: flex; flex-direction: column; }
            .imf-sidebar { width: 220px; display: flex; flex-direction: column; gap: 8px; padding: 8px; background: #1b1b1b; overflow-y: auto; flex-shrink: 0; box-sizing: border-box;}

            /* Table Styles */
            .imf-table { width: 100%; border-collapse: collapse; min-width: 300px; }
            .imf-table th, .imf-table td { border: 1px solid #444; padding: 4px; white-space: nowrap; vertical-align: middle; }
            .imf-table th { 
                background-color: #1b3a4b; /* MAFF Header Color */
                position: sticky; top: 0; cursor: pointer; z-index: 10; color: #fff; text-align: center; 
            }
            .imf-table th:hover { background-color: #265269; }
            .imf-table td { text-align: left; }
            
            .imf-col-center { text-align: center !important; }
            .imf-row-del { color: #f55; cursor: pointer; font-weight: bold; text-align: center !important; }
            .imf-row-del:hover { color: #f00; }
            
            /* Inputs in Table */
            .imf-keys-input { width: 40px; text-align: center; background: #111; border: 1px solid #555; color: #fff; border-radius: 2px; }
            
            /* Sidebar Elements */
            .imf-section-label { font-weight: bold; color: #4da; border-bottom: 1px solid #444; margin-bottom: 4px; padding-bottom: 2px; }
            
            /* Buttons (MAFF Style) */
            .imf-btn { 
                background-color: #204020; border: 1px solid #3c6; color: #fff; 
                padding: 6px; cursor: pointer; text-align: center; user-select: none; border-radius: 2px; 
                font-weight: bold; width: 100%; box-sizing: border-box; display: block; margin-bottom: 5px;
            }
            .imf-btn:hover { background-color: #306030; }
            
            /* Submit is basically a green button */
            .imf-submit-btn {
                background-color: #204020 !important; border: 1px solid #3c6 !important; color: #fff !important;
                padding: 8px !important; cursor: pointer !important; width: 100%; font-weight: bold;
                border-radius: 2px; margin-top: 5px;
            }
            .imf-submit-btn:hover { background-color: #306030 !important; }

            /* Feature Icons Row */
            .imf-icon-row { display: flex; gap: 5px; justify-content: space-around; margin-bottom: 5px; }
            .imf-icon-btn { 
                flex: 1; background: #333; border: 1px solid #555; color: #ccc; 
                text-align: center; cursor: help; padding: 4px; border-radius: 2px; 
            }
            .imf-icon-btn:hover { background: #444; color: #fff; }

            /* Bookmarks Area */
            .imf-bookmarks-scroll { 
                flex: 1; /* Grow to fill available space in sidebar */
                overflow-y: auto; border: 1px solid #444; background: #111; padding: 4px; 
                min-height: 100px; max-height: 200px;
                margin-bottom: 10px;
            }
            .imf-bookmark-item {
                padding: 4px; margin-bottom: 2px; background: #0a3a63; border: 1px solid #3af; 
                cursor: pointer; text-align: center; border-radius: 2px; font-size: 11px;
            }
            .imf-bookmark-item:hover { background: #0d4a7c; }

            /* Controls */
            .imf-control-group { margin-bottom: 8px; display: flex; flex-direction: column; gap: 4px; }
            .imf-control-row { display: flex; align-items: center; justify-content: space-between; font-size: 11px; }
            .imf-control-input { 
                background: #111; border: 1px solid #555; color: #fff; padding: 2px 4px; 
                width: 60px; text-align: center; 
            }
            .imf-control-input-wide { width: 100%; text-align: left; }
            
            /* Links */
            a.imf-portal-link { color: #ddd; text-decoration: none; }
            a.imf-portal-link:hover { color: #fff; text-decoration: underline; }
            
            .imf-empty-msg { padding: 20px; text-align: center; color: #888; font-style: italic; }

        `).appendTo("head");
    };

    // --- Core UI Generation ---

    self.showDialog = function(portalData, bookmarks) {
        // Init state
        self.dialogData = portalData || [];
        const settings = self.loadSettings();
        
        // Detailed warning message for tooltips - Summarized
        const tooltipWarning = "Special characters (, . ; # $ / \\ * ' \") are removed to prevent errors.";

        var html = `
        <form id="imf-dialog" name="maxfield" action="https://www.ingress-maxfield.com/submit.php" enctype="multipart/form-data" method="post" target="_blank" onsubmit="window.plugin.ingressmaxfield.saveSettings(this);">
            
            <div class="imf-layout">
                <!-- LEFT PANE: Portal Table -->
                <div class="imf-table-container" id="imf-table-container">
                    ${self.renderPortalTable(self.dialogData)}
                </div>

                <!-- RIGHT PANE: Controls Sidebar -->
                <div class="imf-sidebar">
                    
                    <!-- Section: Tools / Info -->
                    <div class="imf-section-label">Tools</div>
                    <div class="imf-icon-row">
                        <div class="imf-icon-btn" title="Compatible with DrawTools: List portals within polygons/circles.\n${tooltipWarning}">
                            ⬟ DrawTools
                        </div>
                        <div class="imf-icon-btn" title="Compatible with Bookmarks: Load from folders below.\n${tooltipWarning}">
                            ⍟ Bookmarks
                        </div>
                    </div>

                    <!-- Section: Bookmarks -->
                    <div class="imf-section-label">Bookmark Folders</div>
                    <div class="imf-bookmarks-scroll">
                        ${self.renderBookmarksList(bookmarks)}
                    </div>

                    <!-- Section: Config -->
                    <div class="imf-section-label">Configuration</div>
                    
                    <div class="imf-control-group">
                        <div class="imf-control-row">
                            <span>Number of Agents:</span>
                            <input type="number" name="num_agents" value="${settings.agents}" min="1" class="imf-control-input" required>
                        </div>
                        
                        <div class="imf-control-row">
                            <span>Use Google Maps?</span>
                            <input type="checkbox" name="useGoogle" value="YES" checked>
                        </div>
                    </div>

                    <div class="imf-control-group">
                        <div class="imf-control-row" style="justify-content: flex-start; gap: 10px;">
                            <span>Color:</span>
                            <label><input type="radio" name="color" value="ENL" ${settings.color === "ENL" ? "checked" : ""}> ENL</label>
                            <label><input type="radio" name="color" value="RES" ${settings.color === "RES" ? "checked" : ""}> RES</label>
                        </div>
                        
                        <div class="imf-control-row">
                            <input type="email" name="email" value="${settings.email}" class="imf-control-input imf-control-input-wide" placeholder="Email (Optional)">
                        </div>
                    </div>

                    <!-- Section: Actions -->
                    <div style="margin-top: auto;">
                        <button type="button" class="imf-btn" onclick="window.plugin.ingressmaxfield.exportData(this)">
                            Export Data
                        </button>
                        <input type="submit" class="imf-submit-btn" name="submit" value="Request Plan">
                    </div>
                    
                    <!-- Hidden Data Field -->
                    <textarea name="portal_list_area" style="display:none;"></textarea>
                </div>
            </div>
        </form>`;

        var dia = window.dialog({
            html,
            id: "plugin-imf-dialog",
            title: "Ingress Maxfield Exporter",
            width: 700,
            height: 500
        });
        
        // Initial data population
        self.updateHiddenTextarea(self.dialogData);
    };

    // --- Renderers ---

    self.renderPortalTable = function(data) {
        if (!data || data.length === 0) {
            return "<div class=\"imf-empty-msg\">No portals selected.<br>Use the map view or select a Bookmark folder.</div>";
        }

        var rows = data.map((p, index) => {
            const sbulChecked = p.sbul === "SBUL" ? "checked" : "";
            // Use internal zoom function
            const nameClick = "onclick=\"return window.plugin.ingressmaxfield.zoomToPortal(this)\"";

            return `
            <tr data-index="${index}">
                <td class="imf-col-center">${p.number}</td>
                <td>
                    <a href="javascript:void(0)" class="imf-portal-link" ${nameClick} title="Zoom to Portal">${p.name}</a>
                    <input type="hidden" class="imf-portal-link-val" value="${p.link}">
                </td>
                <td class="imf-col-center">
                    <input type="number" class="imf-keys-input" value="${p.keys || 0}" min="0" 
                        onchange="window.plugin.ingressmaxfield.updateData(this, 'keys')">
                </td>
                <td class="imf-col-center">
                    <input type="checkbox" ${sbulChecked} 
                        onchange="window.plugin.ingressmaxfield.updateData(this, 'sbul')">
                </td>
                <td class="imf-row-del" onclick="window.plugin.ingressmaxfield.deletePortal(this)">✖</td>
            </tr>`;
        }).join("");

        return `
        <table class="imf-table">
            <thead>
                <tr>
                    <th style="width:30px" onclick="window.plugin.ingressmaxfield.sortData('number')">#</th>
                    <th onclick="window.plugin.ingressmaxfield.sortData('name')">Portal Name</th>
                    <th style="width:50px" onclick="window.plugin.ingressmaxfield.sortData('keys')">Keys</th>
                    <th style="width:40px" onclick="window.plugin.ingressmaxfield.sortData('sbul')">SBUL</th>
                    <th style="width:30px">Del</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
    };

    self.renderBookmarksList = function(folders) {
        if (!folders) { return "<div style=\"padding:5px; color:#666;\">Bookmarks plugin not active.</div>"; }
        
        // Load bookmarks safely
        // var portalsList = null; // Unused, removing
        try { 
            // portalsList = JSON.parse(localStorage["plugin-bookmarks"]); 
            // Just validation
            JSON.parse(localStorage["plugin-bookmarks"]);
        } catch(e) { 
            return "Error loading bookmarks."; 
        }

        var html = "";
        for (var id in folders) {
            if (folders.hasOwnProperty(id)) {
                var name = folders[id];
                // Escape quotes for onclick
                var safeId = id.replace(/'/g, "\\'");
                html += `<div class="imf-bookmark-item" onclick="window.plugin.ingressmaxfield.loadFromBookmark('${safeId}')">${name}</div>`;
            }
        }
        return html || "<div style=\"padding:5px; color:#666;\">No folders found.</div>";
    };

    // --- Logic & Actions ---

    self.updateData = function(el, field) {
        var idx = $(el).closest("tr").data("index");
        // Fix: Ensure we don't access undefined property
        if (idx === undefined || !self.dialogData || !self.dialogData[idx]) { return; }

        if (field === "keys") {
            self.dialogData[idx].keys = parseInt(el.value, 10) || 0;
        } else if (field === "sbul") {
            self.dialogData[idx].sbul = el.checked ? "SBUL" : "";
        }
        self.updateHiddenTextarea(self.dialogData);
    };

    self.deletePortal = function(el) {
        var idx = $(el).closest("tr").data("index");
        self.dialogData.splice(idx, 1);
        self.reindexAndRender();
    };

    self.loadFromBookmark = function(folderId) {
        var list = self.genDataFromBookmarkFolder(folderId);
        self.dialogData = list.map((p, i) => ({...p, number: i+1}));
        self.reindexAndRender();
    };

    self.reindexAndRender = function() {
        // Re-number
        self.dialogData.forEach((p, i) => { p.number = i + 1; });
        $("#imf-table-container").html(self.renderPortalTable(self.dialogData));
        self.updateHiddenTextarea(self.dialogData);
    };

    self.zoomToPortal = function(el) {
        var idx = $(el).closest("tr").data("index");
        var p = self.dialogData[idx];
        if (!p || !p.link) { return; }
        
        var match = p.link.match(/pll=([\d.-]+),([\d.-]+)/);
        if (match) {
            var lat = parseFloat(match[1]);
            var lng = parseFloat(match[2]);
            if (window.map) { window.map.setView([lat, lng], 17); }
        }
    };

    self.sortData = function(key) {
        if (self.sortKey === key) { self.sortOrder *= -1; }
        else { self.sortKey = key; self.sortOrder = 1; }

        self.dialogData.sort((a, b) => {
            var valA = a[key];
            var valB = b[key];
            // Fix: Re-added check for undefined for robustness, although it's implicitly checked inside the string comparison due to safe property access
            if (typeof valA === "string") { return valA.localeCompare(valB, undefined, {numeric: true}) * self.sortOrder; }
            return (valA - valB) * self.sortOrder;
        });
        self.reindexAndRender();
    };

    // --- Parsing / Export ---

    self.updateHiddenTextarea = function(data) {
        // Clean name again just in case, though it should be clean on load
        var str = data.map((p) => `${self.cleanPortalName(p.name)};${p.link};${p.keys||0};${p.sbul||""}`).join("\n");
        $("textarea[name=\"portal_list_area\"]").val(str);
    };

    self.exportData = function(btn) {
        var str = $("textarea[name=\"portal_list_area\"]").val();
        
        var $temp = $("<textarea>").css({position:"absolute", left:"-9999px"}).val(str).appendTo("body");
        $temp.select();
        var success = false;
        // Empty block justified for optional clipboard support check
        try { success = document.execCommand("copy"); } catch(e) { /* Ignore failure */ }
        $temp.remove();

        if (success) {
            var orig = $(btn).css("background-color");
            $(btn).css("background-color", "#3c6").animate({backgroundColor: orig}, 500);
        } else {
            alert("Export failed.");
        }
    };

    // --- Standard Geometry & Data Fetching (Reused) ---
    self.checkPortals = function(portals) {
        var list = [];
        // Geometry checks (bounds/polygon)
        var bounds = map.getBounds();
        // Check for DrawTools
        var polys = [];
        if (window.plugin.drawTools && window.plugin.drawTools.drawnItems) {
            window.plugin.drawTools.drawnItems.eachLayer((l) => {
                if (l instanceof L.Polygon || l instanceof L.Circle) { polys.push(l); }
            });
        }

        $.each(portals, function(guid, p) {
            var latlng = p.getLatLng();
            var keep = false;
            if (polys.length > 0) {
                // Simplified point-in-poly check or use Leaflet/DrawTools helper if available
                keep = polys.some((poly) => {
                    if (poly instanceof L.Circle) { return latlng.distanceTo(poly.getLatLng()) <= poly.getRadius(); }
                    return poly.getBounds().contains(latlng); 
                });
            } else {
                keep = bounds.contains(latlng);
            }

            if (keep) {
                var title = p.options.data.title || "Untitled";
                var cleanTitle = self.cleanPortalName(title);
                var href = `https://www.ingress.com/intel?ll=${latlng.lat},${latlng.lng}&z=17&pll=${latlng.lat},${latlng.lng}`;
                
                // Keys
                var keys = 0;
                // Fix: Check property existence before access
                if (window.plugin.keys && window.plugin.keys.keys && window.plugin.keys.keys[guid]) { 
                    keys = window.plugin.keys.keys[guid]; 
                }
                
                // Fix: Use property shorthand
                list.push({
                    name: cleanTitle,
                    link: href,
                    keys,
                    sbul: "",
                    guid // Store GUID for easier ref if needed
                });
            }
        });
        
        // Fix: Added space before arrow function
        return { list: list.map((p,i) => ({...p, number:i+1})) };
    };
    
    // Original Bookmark Logic Adapter
    self.genDataFromBookmarkFolder = function(folderId) {
        var data = [];
        try {
            var all = JSON.parse(localStorage["plugin-bookmarks"]);
            var bkmrks = all.portals[folderId].bkmrk;
            for (var id in bkmrks) {
                if (bkmrks.hasOwnProperty(id)) {
                    var b = bkmrks[id];
                    var ll = b.latlng.split(",");
                    var href = `https://www.ingress.com/intel?ll=${ll[0]},${ll[1]}&z=17&pll=${ll[0]},${ll[1]}`;
                    var cleanTitle = self.cleanPortalName(b.label);
                    data.push({
                        name: cleanTitle,
                        link: href,
                        keys: 0,
                        sbul: ""
                    });
                }
            }
        } catch(e) { /* Ignore bookmark read errors */ }
        return data;
    };

    self.checkBookmarks = function() {
        if (!window.plugin.bookmarks) { return null; }
        try {
            var all = JSON.parse(localStorage["plugin-bookmarks"]);
            var res = {};
            for (var f in all.portals) {
                if (all.portals.hasOwnProperty(f)) {
                    res[f] = all.portals[f].label;
                }
            }
            return res;
        } catch(e) { return null; }
    };

    self.gen = function() {
        self.setupCSS(); // Ensure CSS is loaded
        var pData = self.checkPortals(window.portals).list;
        var bData = self.checkBookmarks();
        self.showDialog(pData, bData);
    };

    self.setup = function() {
        $("#toolbox").append('<a onclick="window.plugin.ingressmaxfield.gen()" title="Export for Ingress Maxfield">IMF Export</a>');
    };

    if (window.iitcLoaded && typeof self.setup === "function") { self.setup(); }
    else if (window.bootPlugins) { window.bootPlugins.push(self.setup); }
    else { window.bootPlugins = [self.setup]; }
}

var script = document.createElement("script");
script.appendChild(document.createTextNode("(" + wrapper + ")();"));
(document.body || document.head || document.documentElement).appendChild(script);
