goog.provide('annotorious');

goog.require('goog.dom');
goog.require('goog.dom.query');
goog.require('goog.array');
goog.require('annotorious.dom');
goog.require('annotorious.events');
goog.require('annotorious.modules.Module');
goog.require('annotorious.modules.image.ImageModule');
goog.require('annotorious.modules.openlayers.OpenLayersModule');

/**
 * The main entrypoint to the application. The Annotorious class is instantiated exactly once,
 * and added to the global window object as 'window.anno'. It exposes the external JavaScript API
 * and internally manages the 'modules'. (Each module is responsible for one particular media
 * type - image, OpenLayers, etc.)  
 * @constructor
 */
annotorious.Annotorious = function() {
  /** @private **/
  this._modules = [ new annotorious.modules.image.ImageModule() ];
  
  if (annotorious.modules.openlayers.OpenLayersModule)
    this._modules.push(new annotorious.modules.openlayers.OpenLayersModule());
  
  /** @private **/
  this._plugins = [];

  var self = this;
  annotorious.dom.addOnLoadHandler(function() { 
    goog.array.forEach(self._modules, function(module) {
      module.init();
    });

    goog.array.forEach(self._plugins, function(plugin) {
      if (plugin.initPlugin)
        plugin.initPlugin(self);
        
      goog.array.forEach(self._modules, function(module) {
        module.addPlugin(plugin);
      });
    });
  });
}

/**
 * Returns the module that is in charge of handling the item with the specified
 * URL or null, if no responsible module is found.
 * @param {string} item_src the URL of the annotatable item 
 * @return {Object | null}
 * @private
 */
annotorious.Annotorious.prototype._getModuleForItemSrc = function(item_src) {
  return goog.array.find(this._modules, function(module) {
    return module.annotatesItem(item_src);
  });
}

/**
 * 'Manually' actives the selector, bypassing the selection widget. Note: this also
 * works when the selection widget is hidden. Primary use case for this is for developers
 * who want to build their own selector widgets or 'Create Annotation' buttons.
 * The selector can be activated on a specific item or globally, on all items (which 
 * serves mainly as a shortcut for pages where there is only one annotatable item).
 * The function can take a callback function as parameter, which will be called when the
 * selector is deactivated again.
 * @param {string | Function} opt_item_url_or_callback the URL of the item, or a callback function
 * @param {Function} opt_callback a callback function (if the first parameter was a URL)
 */
annotorious.Annotorious.prototype.activateSelector = function(opt_item_url_or_callback, opt_callback) {
  var item_url = undefined,
      callback = undefined;

  if (goog.isString(opt_item_url_or_callback)) {
    item_url = opt_item_url_or_callback;
    callback = opt_callback;
  } else if (goog.isFunction(opt_item_url_or_callback)) {
    callback = opt_item_url_or_callback;
  }

  if (item_url) {
    var module = this._getModuleForItemSrc(item_url);
    if (module)
      module.activateSelector(item_url, callback);
  } else {
    goog.array.forEach(this._modules, function(module) {
      module.activateSelector(callback);
    });
  }
}

/**
 * Adds an annotation to an item on the page.
 * @param {annotorious.annotation.Annotation} annotation the annotation
 * @param {annotorious.annotation.Annotation} opt_replace optionally, an existing annotation to replace
 */
annotorious.Annotorious.prototype.addAnnotation = function(annotation, opt_replace) {
  var module = this._getModuleForItemSrc(annotation.src); 
  if (module)
    module.addAnnotation(annotation, opt_replace);
}

/**
 * Adds an event handler to Annotorious.
 * @param {annotorious.events.EventType} type the event type
 * @param {Function} handler the handler function
 */
annotorious.Annotorious.prototype.addHandler = function(type, handler) {
  goog.array.forEach(this._modules, function(module) {
    module.addHandler(type, handler);
  });
}

/**
 * Adds a plugin to Annotorious.
 * @param {string} plugin_name the plugin name
 * @param {Object} opt_config_options an optional object literal with plugin config options
 */
annotorious.Annotorious.prototype.addPlugin = function(plugin_name, opt_config_options) {
  try {
    this._plugins.push(new window['annotorious']['plugin'][plugin_name](opt_config_options));  
  } catch (error) {
    console.log('Could not load plugin: ' + plugin_name);
  }
}

/**
 * Returns the name of the selector that is currently activated on a 
 * particular item.
 * @param {string} item_url the URL of the item to query for the active selector
 */
annotorious.Annotorious.prototype.getActiveSelector = function(item_url) {
  var module = this._getModuleForItemSrc(item_url);
  if (module)
    return module.getActiveSelector(item_url);
  else
    return undefined;
}

/**
 * Returns all annotations on the annotatable item with the specified URL, or
 * all annotations on the page in case no URL is specified.
 * @param {string | undefined} opt_item_url an item URL (optional)
 * @return {Array.<annotorious.annotation.Annotation>} the annotations
 */
annotorious.Annotorious.prototype.getAnnotations = function(opt_item_url) {
  if (opt_item_url) {
    var module = this._getModuleForItemSrc(opt_item_url);
    if (module)
      return module.getAnnotations(opt_item_url);
    else
      return [];
  } else {
    var annotations = [];
    goog.array.forEach(this._modules, function(module) {
      goog.array.extend(annotations, module.getAnnotations());
    });
    return annotations;
  }
}

/**
 * Returns the list of available shape selectors for a particular item.
 * @param {string} item_url the URL of the item to query for available selectors
 * @returns {Array.<string>} the list of selector names
 */
annotorious.Annotorious.prototype.getAvailableSelectors = function(item_url) {
  var module = this._getModuleForItemSrc(item_url);
  if (module)
    return module.getAvailableSelectors(item_url);
  else
    return [];
}

/**
 * Hides existing annotations on all, or a specific item.
 * @param {string} opt_item_url the URL of the item
 */
annotorious.Annotorious.prototype.hideAnnotations = function(opt_item_url) {
  if (opt_item_url) {
    var module = this._getModuleForItemSrc(opt_item_url);
    if (module)
      module.hideAnnotations(opt_item_url);
  } else {
    goog.array.forEach(this._modules, function(module) {
      module.hideAnnotations();
    });
  }
}

/**
 * Hides the selection widget, thus preventing users from creating new annotations.
 * The selection widget can be hidden on a specific item or globally, on all annotatable
 * items on the page.
 * @param {string | undefined} opt_item_url the URL of the item on which to hide the selection widget
 */
annotorious.Annotorious.prototype.hideSelectionWidget = function(opt_item_url) {
  if (opt_item_url) {
    var module = this._getModuleForItemSrc(opt_item_url);
    if (module)
      module.hideSelectionWidget(opt_item_url);
  } else {
    goog.array.forEach(this._modules, function(module) {
      module.hideSelectionWidget();
    });
  }
}

/**
 * Highlights the specified annotation.
 * @param {annotorious.annotation.Annotation} annotation the annotation
 */
annotorious.Annotorious.prototype.highlightAnnotation = function(annotation) {
  if (annotation) {
    var module = this._getModuleForItemSrc(annotation.src);

    if (module)
      module.highlightAnnotation(annotation);
  } else {
    goog.array.forEach(this._modules, function(module) {
      module.highlightAnnotation();
    });
  }
}

/**
 * Makes an item annotatable, if there is a module that supports the item type.
 * @param {Object} item the annotatable item
 */
annotorious.Annotorious.prototype.makeAnnotatable = function(item) {
  var module = goog.array.find(this._modules, function(module) {
    return module.supports(item);
  });

  if (module)
    module.makeAnnotatable(item);
  else
    throw('Error: Annotorious does not support this media type in the current version or build configuration.');
}

/**
 * Removes all annotations. If the optional parameter opt_item_url is set,
 * only the annotations on the specified item will be removed. Otherwise all
 * annotations on all items on the page will be removed.
 * @param {string} opt_item_url the src URL of the item
 */
annotorious.Annotorious.prototype.removeAll = function(opt_item_url) {
  // TODO this could be optimized a lot by adding a .removeAll method
  // to modules and annotators!
  var self = this;
  goog.array.forEach(this.getAnnotations(opt_item_url), function(annotation) {
    self.removeAnnotation(annotation);    
  });
}

/**
 * Removes an annotation from an item on the page.
 * @param {annotorious.annotation.Annotation} annotation the annotation to remove
 */
annotorious.Annotorious.prototype.removeAnnotation = function(annotation) {
  var module = this._getModuleForItemSrc(annotation.src);
  if (module)
    module.removeAnnotation(annotation);
}

/**
 * Resets annotation functionality on this page. After the reset, annotation
 * functionality will be reomved from all items. Images with the 'annotatable'
 * CSS class will have been re-initialized (i.e. they will be annotatable, with
 * a fresh annotator).
 */
annotorious.Annotorious.prototype.reset = function(annotation) {
  goog.array.forEach(this._modules, function(module) {
    module.destroy();
    module.init();
  });
}

/**
 * Adds a selector to a particular item.
 *
 * !! TEMPORARY !! 
 *
 * TODO selectors should be added to annotators directly, from within a plugin
 * which will make this method unecessary
 */
annotorious.Annotorious.prototype.addSelector = function(item_url, selector) {
  var module = this._getModuleForItemSrc(item_url);
  if (module)
    module.addSelector(item_url, selector);  
}

/**
 * Sets a specific selector on a particular item.
 * @param {string} item_url the URL of the item on which to set the selector
 * @param {string} selector the name of the selector to set on the item
 */
annotorious.Annotorious.prototype.setActiveSelector = function(item_url, selector) {
  var module = this._getModuleForItemSrc(item_url);
  if (module)
    module.setActiveSelector(item_url, selector);  
}

/**
 * Enables (or disables) the ability to create new annotations on an annotatable item.
 * @param {boolean} enabled if true, new annotations can be created
 *
 * !!!!
 * @deprecated will be removed in v1.0!
 * !!!!
 */
annotorious.Annotorious.prototype.setSelectionEnabled = function(enabled) {
  if (enabled)
    this.showSelectionWidget(undefined);
  else
    this.hideSelectionWidget(undefined);
}

/**
 * Shows existing annotations on all, or a specific item.
 * @param {string} opt_item_url the URL of the item
 */
annotorious.Annotorious.prototype.showAnnotations = function(opt_item_url) {
  if (opt_item_url) {
    var module = this._getModuleForItemSrc(opt_item_url);
    if (module)
      module.showAnnotations(opt_item_url);
  } else {
    goog.array.forEach(this._modules, function(module) {
      module.showAnnotations();
    });
  } 
}

/**
 * Shows the selection widget, thus enabling users to create new annotations.
 * The selection widget can be made visible on a specific item or globally, on all
 * annotatable items on the page.
 * @param {string | undefined} opt_item_url the URL of the item on which to show the selection widget 
 */
annotorious.Annotorious.prototype.showSelectionWidget = function(opt_item_url) {
  if (opt_item_url) {
    var module = this._getModuleForItemSrc(opt_item_url);
    if (module)
      module.showSelectionWidget(opt_item_url);
  } else {
    goog.array.forEach(this._modules, function(module) {
      module.showSelectionWidget();
    });
  }
}

/** API exports **/
window['anno'] = new annotorious.Annotorious();
annotorious.Annotorious.prototype['activateSelector'] = annotorious.Annotorious.prototype.activateSelector;
annotorious.Annotorious.prototype['addAnnotation'] = annotorious.Annotorious.prototype.addAnnotation;
annotorious.Annotorious.prototype['addHandler'] = annotorious.Annotorious.prototype.addHandler;
annotorious.Annotorious.prototype['addPlugin'] = annotorious.Annotorious.prototype.addPlugin;
annotorious.Annotorious.prototype['getActiveSelector'] = annotorious.Annotorious.prototype.getActiveSelector;
annotorious.Annotorious.prototype['getAnnotations'] = annotorious.Annotorious.prototype.getAnnotations;
annotorious.Annotorious.prototype['getAvailableSelectors'] = annotorious.Annotorious.prototype.getAvailableSelectors;
annotorious.Annotorious.prototype['hideAnnotations'] = annotorious.Annotorious.prototype.hideAnnotations;
annotorious.Annotorious.prototype['hideSelectionWidget'] = annotorious.Annotorious.prototype.hideSelectionWidget;
annotorious.Annotorious.prototype['highlightAnnotation'] = annotorious.Annotorious.prototype.highlightAnnotation;
annotorious.Annotorious.prototype['makeAnnotatable'] = annotorious.Annotorious.prototype.makeAnnotatable;
annotorious.Annotorious.prototype['removeAll'] = annotorious.Annotorious.prototype.removeAll;
annotorious.Annotorious.prototype['removeAnnotation'] = annotorious.Annotorious.prototype.removeAnnotation;
annotorious.Annotorious.prototype['reset'] = annotorious.Annotorious.prototype.reset;
annotorious.Annotorious.prototype['setActiveSelector'] = annotorious.Annotorious.prototype.setActiveSelector;
annotorious.Annotorious.prototype['showAnnotations'] = annotorious.Annotorious.prototype.showAnnotations;
annotorious.Annotorious.prototype['showSelectionWidget'] = annotorious.Annotorious.prototype.showSelectionWidget;

/** !!! TEMPORARY **/
annotorious.Annotorious.prototype['addSelector'] = annotorious.Annotorious.prototype.addSelector;

/** @deprecated **/
annotorious.Annotorious.prototype['setSelectionEnabled'] = annotorious.Annotorious.prototype.setSelectionEnabled;
