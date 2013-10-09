/**
 * @description Autocomplete plug-in used to provide a look ahead search 
 * for common collections on the Clip Admin backbone pages such as 
 * stations, advertisers, and vendors.  This plug-in assumes that the 
 * jquery.ui.autocomplete plug-in is available.  This plug-in also will 
 * only work if Backbone is defined and the models and collections are 
 * valid Backbone instances.  We take advantage of the fact that all of 
 * our collection models each have an ID and a name field, thus we can 
 * treat them similarly when selecting a result or populating a result.
 * @param options An object consisting of the following fields:
 * @param.model An instance backbone model we're searching for, required.
 * @param.collection An instance backbone collection we're searching for
 * matching models in, required.
 * @param.searchParam The name of the search parameter to pass to the 
 * server side (e.g. "name", "text", etc.), required.
 * @param.labelField An optional parameter that specifies the value to
 * use from the models to use when populating the drop down list.  The
 * default value is the "name" field.
 */
(function( $ ) {

  var pluginName = "jQuery.autocompletecollection";
  
  var init = function(options) { 

    if (typeof(options) === "undefined" ||
      typeof(options.model) === "undefined" || 
      typeof(options.collection) === "undefined" ||
      typeof(options.searchParam) === "undefined") 
    {
      $.error("Please specify a model, collection and search parameter in the options for " + pluginName + ".");
      return this;
    }

    options.labelField = options.labelField || "name";

    return this.each(function() {
      var $input = $(this);

      // Return if the plug-in has already been applied to the input.
      if ($input.data("autocompletecollectiondata")) {
        return;
      }

      // Reset the pagination state so that our autocomplete results don't
      // accidentally pick up search results saved in the pagination state 
      // cookie that is populated when navigating through the view all page for
      // the same collection!

      if (typeof(options.collection.resetPaginationState) === "function") {
        options.collection.resetPaginationState();
      }

      $input.data("autocompletecollectiondata", { 
        model: options.model, 
        collection: options.collection,
        searchParam: options.searchParam,
        labelField: options.labelField
      });

      $input.on("focus.autocompletecollection", input_focus);
      $input.on("change.autocompletecollection", input_change);
    });
  };

  /**
   * @description Return the name and ID of the selected model to the caller.  The ID
   * is saved in the autocompletecollectionid data attribute we add to the input when
   * a value is selected from the autocomplete search results.
   */
  var getValue = function() {

    var $input = $(this);
      
    return {
      id: $input.data("autocompletecollectionid") || "",
      name: $input.val()
    };
  };

  /**
   * @description Set the id and name on the input.  This is used when populating the 
   * lookahead search results in an edit view, for example.
   * @param options An object containg the following required fields.
   * @param options.id The ID of the model to retrieve.  We'll use the name from the 
   * fetch() result.
   */
  var setValue = function(options) {
    
    if (typeof(options.id) === "undefined") {
      $.error("Please specify the id of the model when setting a value on a " + pluginName + " instance.")
    }

    var $input = $(this);
    var data = $input.data("autocompletecollectiondata");

    if (! data) {
      return this;
    }

    var model = data.model;
    model.set("id", options.id, {silent: true});

    model.fetch({
      success: function() { 
        $input.val(model.get("name"));
        $input.data("autocompletecollectionid", options.id);
      },
      error: function() { 
        $input.val("");
      }
    });
  };

  /**
   * @description Set the search parameters on the collection for each of the name value
   * pairs in the specified options.
   */
  var setSearchParams = function(options) {

    return this.each(function() { 
      if (typeof(options) !== "object") {
        return;
      }

      var $input = $(this);
      
      for (var key in options) {

        var value = options[key];       
        var data = $input.data("autocompletecollectiondata");

        if (! data || typeof(data.collection) === "undefined") {
          return;
        }

        data.collection.searchParam(key, value);
      }
    });
  };

  /**
   * @description Remove our the autocomplete plug-in from the input and then
   * remove our data and custom events.
   */
  var destroy = function() { 

    return this.each(function() { 
      var $input = $(this);

      // Return if the plug-in hasn't been applied to the input.
      if (! $input.data("autocompletecollectiondata")) {
        return;
      }
      
      $input.autocomplete("destroy");
      $input.removeData("autocompletecollectiondata");
      $input.removeData("autocompletecollectionid");
      $input.off("focus.autocompletecollection");
      $input.off("change.autocompletecollection");
    });
  };

  var input_focus = function(e) { 

    var $input = $(e.target);

    // The jQuery UI Autocomplete documentation states that the change event
    // will be triggered when the field is blurred, if the value has changed.
    // But this is not the case.  The change event is triggered even if the 
    // value hasn't changed!  So upon focusing on the input, we save the 
    // previous value, and in our change event handler, if there is no item and
    // the previous value is the same as the new value, then we know that the 
    // user focused on the field, and changed nothing; so we won't clear the 
    // input's value.  

    $input.data("autocompletecollectionprevval", $input.val())

    // If the autocomplete plug-in has already been applied to the element
    // just return, the plug-in will handle the focus 
    if ($input.data("autocomplete")) {
      return;
    }

    /** 
     * @description When the input element is blurred and its value has changed
     * we look to see if we have a selected item, and if so we set values on
     * the input for use next.  Else we clear the values.  And in both cases we
     * trigger a change event on the input passing the triggered by "flag" so 
     * in our onchange handler we know that we should let this event propagate 
     * to the caller so that the newly selected value, or lack there of, can be 
     * handled there.
     */
    var fChange = function(e, ui) {
      e.preventDefault();
      e.stopImmediatePropagation();

      if (ui.item) {
        $input.data("autocompletecollectionid", ui.item.value);
        $input.val(ui.item.label);
      }
      else { 
        if ($input.val() == $input.data("autocompletecollectionprevval")) {
          $input.removeData("autocompletecollectionprevval");
          return;
        }
        else {
          $input.removeData("autocompletecollectionprevval");
          $input.removeData("autocompletecollectionid");
          $input.val("");
        }
      }

      $input.trigger("change", { triggeredBy: "autocompletecollection" });
    };

    /**
     * @description When focusing on an item in the autocomplete results list
     * replace the value of the input with the select item's label, not its 
     * value.
     */
    var fFocus = function(e, ui) {
      e.preventDefault();
      $input.val(ui.item.label);
    };

    /**
     * @description Save the selected model ID to a data attribute and display 
     * its title in the input element if an item was selected; clear both if 
     * one wasn't.
     */
    var fSelect = function(e, ui) {
      e.preventDefault();

      if (ui.item) {
        $input.data("autocompletecollectionid", ui.item.value);
        $input.val(ui.item.label);
      }
      else { 
        $input.removeData("autocompletecollectionid");
        $input.val("");
      }
    };

    /**
     * @description Create a new collection, specify the search parameter, and then
     * fetch the first 10 matches, creating an array of label/value pairs to display
     * in the autocomplete plug-in results.
     */
    var fSource = function(acRequest, acResponse) {
    
      $input.addClass("loading-small");

      var collection = $input.data("autocompletecollectiondata").collection;
      var searchParam = $input.data("autocompletecollectiondata").searchParam;
      var labelField = $input.data("autocompletecollectiondata").labelField;

      collection.searchParam(searchParam, acRequest.term);
      collection.howManyPer(10);

      var fSuccess = function(collection, response, options) {
        $input.removeClass("loading-small");

        var data = [];

        collection.each(function(model) { 
          data.push({
            label: model.get(labelField),
            value: model.get("id")
          });
        });

        if (data.length == 0) {
          data.push({ label: "No matches found!", value: null });
        }

        acResponse(data);
      };

      var fError = function(collection, xhr, options) {
        $input.removeClass("loading-small");
        acResponse([{ label: "Unable to search for items!", value: null }]);
      };

      collection.fetch({ 
        success: fSuccess, 
        error: fError 
      });
    };

    $input.autocomplete({
      change: fChange,
      delay: 500,
      focus: fFocus,
      minLength: 3,
      select: fSelect,
      source: fSource
    });
  }; 

  /**
   * @description Allow on change events that we triggered ourselves in our
   * event handler for the autocompletechange event fired by the autocomplete
   * plug in to propagate to the caller.  In doing this, we are more or less 
   * hyjacking the onchange event and only surfacing the one we want to the 
   * caller.  We do this because two onchange events are fired.  The first when
   * an item is selected in the results list and the second when the input 
   * element loses focus.  We can't let both of these onchange events propagate
   * to the caller because setting a property to the same value twice on a
   * Backbone model will result setting the changed property to false, which
   * is wrong, because while we have have just set a property to the same value
   * it previously had, things may have still "changed" on the model.
   */
  var input_change = function(e, data) { 
    
    if (data && data.triggeredBy === "autocompletecollection") {
      return;
    }

    e.preventDefault();
    e.stopImmediatePropagation();
  };

  var methods = {
    "init": init,
    "getValue": getValue,
    "setValue": setValue,
    "setSearchParams": setSearchParams,
    "destroy": destroy
  };

  $.fn.autocompletecollection = function(method) {
    
    if (methods[method]) {
      return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
    }
    else if (typeof method === "object" || !method) {
      return methods.init.apply(this, arguments);
    }
    else {
      $.error("Method " + method + " does not exist on " + pluginName + ".");
    } 
  };

})(jQuery);
