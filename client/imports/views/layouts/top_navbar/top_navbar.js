import { Template } from 'meteor/templating';
import { Session } from 'meteor/session';
import { FlowRouter } from 'meteor/kadira:flow-router';
import Helper from '/client/imports/helpers/helper';
import { Communicator } from '/client/imports/facades';
import { Connections } from '/lib/imports/collections';
import { connect, populateConnectionsTable } from '/client/imports/views/layouts/top_navbar/connections/connections';
import './top_navbar.html';

const toastr = require('toastr');
const Ladda = require('ladda');
const packageJson = require('/package.json');

require('datatables.net')(window, $);
require('datatables.net-buttons')(window, $);
require('datatables.net-responsive')(window, $);

require('datatables.net-bs')(window, $);
require('datatables.net-buttons-bs')(window, $);
require('datatables.net-responsive-bs')(window, $);

export const loadFile = function (currentVal, input, done, readAsString) {
  const fileInput = input.siblings('.bootstrap-filestyle').children('input');
  if (input[0].files.length == 0 && currentVal && fileInput.val()) {
    done(currentVal);
  } else if (input[0].files.length != 0) {
    const fileReader = new FileReader();
    fileReader.onload = function (file) {
      if (readAsString) done(file.target.result);
      else done(new Uint8Array(file.target.result));
    };

    if (readAsString) fileReader.readAsText(input[0].files[0], 'UTF-8');
    else fileReader.readAsArrayBuffer(input[0].files[0]);
  } else {
    done([]);
  }
};

const init = function () {
  $('.filestyle').filestyle({});
  const selectorForSwitchDatabases = $('#tblSwitchDatabases');
  selectorForSwitchDatabases.find('tbody').on('click', 'tr', function () {
    const table = selectorForSwitchDatabases.DataTable();
    Helper.doTableRowSelectable(table, $(this));

    if (table.row(this).data()) {
      $('#inputDatabaseNameToSwitch').val(table.row(this).data().name);
    }
  });

  $('#versionText').html(packageJson.version);
};

const populateSwitchDatabaseTable = function (data) {
  const tblSwitchDatabases = $('#tblSwitchDatabases');

  tblSwitchDatabases.DataTable({
    responsive: true,
    destroy: true,
    data,
    columns: [
      { data: 'name' },
    ],
    columnDefs: [],
  }).draw();
};

Template.topNavbar.onRendered(function () {
  const connections = this.subscribe('connections');
  this.autorun(() => {
    if (connections.ready()) {
      init();
    }
  });
});

Template.topNavbar.events({
  'click #btnProceedImportExport': function (e) {
    e.preventDefault();
    const laddaButton = Ladda.create(document.querySelector('#btnProceedImportExport'));
    const importInput = $('#inputImportBackupFile');

    if (importInput.val()) {
      laddaButton.start();
      loadFile(null, importInput, (val) => {
        Communicator.call({
          methodName: 'importMongoclient',
          args: { file: val },
          callback: (err) => {
            if (err) {
              toastr.error(`Couldn't import: ${err.message}`);
            } else {
              toastr.success(`Successfully imported from ${importInput.siblings('.bootstrap-filestyle').children('input').val()}`);
              $('#importExportMongoclientModal').modal('hide');
            }

            Ladda.stopAll();
          }
        });
      }, true);
    }
  },

  'change .filestyle': function (e) {
    const inputSelector = $(`#${e.currentTarget.id}`);
    const blob = inputSelector[0].files[0];
    const fileInput = inputSelector.siblings('.bootstrap-filestyle').children('input');

    if (blob) {
      fileInput.val(blob.name);
    } else {
      fileInput.val('');
    }
  },

  'click #btnRefreshCollections2': function () {
    connect(true);
  },

  'click #btnExportMongoclient': function (e) {
    e.preventDefault();
    window.open('exportMongoclient');
  },

  'click #btnImportMongoclient': function (e) {
    e.preventDefault();
    const icon = $('#importExportMongoclientIcon');
    $('#importExportMongoclientTitle').text('Import Mongoclient Data');
    icon.addClass('fa-download');
    icon.removeClass('fa-upload');
    $('#btnProceedImportExport').text('Import');
    $('#frmImportMongoclient').show();
    $('#frmExportMongoclient').hide();
    $('#importExportMongoclientModal').modal('show');
  },

  'click #btnAboutMongoclient': function (e) {
    e.preventDefault();
    $('#aboutModal').modal('show');
  },

  'click #btnSwitchDatabase': function (e) {
    e.preventDefault();
    $('#switchDatabaseModal').modal('show');

    Ladda.create(document.querySelector('#btnConnectSwitchedDatabase')).start();

    Communicator.call({
      methodName: 'listDatabases',
      callback: (err, result) => {
        if (err || result.error) {
          Helper.showMeteorFuncError(err, result, "Couldn't fetch databases");
        } else {
          result.result.databases.sort((a, b) => {
            if (a.name < b.name) { return -1; } else if (a.name > b.name) { return 1; }
            return 0;
          });

          populateSwitchDatabaseTable(result.result.databases);
          Ladda.stopAll();
        }
      }
    });
  },

  'click #btnConnectionList': function () {
    if (!Session.get(Helper.strSessionConnection)) {
      populateConnectionsTable();

      $('#tblConnection').DataTable().$('tr.selected').removeClass('selected');
      $('#btnConnect').prop('disabled', true);
    }
  },

  'click #btnConnectSwitchedDatabase': function () {
    const selector = $('#inputDatabaseNameToSwitch');
    if (!selector.val()) {
      toastr.error('Please enter a database name or choose one from the list');
      return;
    }

    Ladda.create(document.querySelector('#btnConnectSwitchedDatabase')).start();
    const connection = Connections.findOne({ _id: Session.get(Helper.strSessionConnection) });
    connection.databaseName = selector.val();

    Communicator.call({ methodName: 'saveConnection', args: { connection } });
    connect(false);
  },

  // Toggle left navigation
  'click #navbar-minimalize': function (event) {
    event.preventDefault();

    const body = $('body');
    const sideMenu = $('#side-menu');
    const nav = $('.navbar-static-side');
    const pageWrapper = $('#page-wrapper');

    // Toggle special class
    body.toggleClass('mini-navbar');

    // Enable smoothly hide/show menu
    if (!body.hasClass('mini-navbar') || body.hasClass('body-small')) {
      // Hide menu in order to smoothly turn on when maximize menu
      sideMenu.hide();
      // For smoothly turn on menu
      setTimeout(() => {
        sideMenu.fadeIn(400);
      }, 200);
    } else if (body.hasClass('fixed-sidebar')) {
      sideMenu.hide();
      setTimeout(() => {
        sideMenu.fadeIn(400);
      }, 100);
    } else {
      // Remove all inline style from jquery fadeIn  to reset menu state
      sideMenu.removeAttr('style');
    }

    setTimeout(() => {
      nav.removeAttr('style');
      if (nav.css('display') === 'block') pageWrapper.css('margin', `0 0 0 ${nav.width()}px`);
      if (nav.css('display') === 'none') pageWrapper.css('margin', '0');
    }, 300);
  },

  'click #btnConnect': function () {
    // loading button
    Ladda.create(document.querySelector('#btnConnect')).start();
    connect(false);
  },

  'click #btnDisconnect': function (e) {
    e.preventDefault();

    Communicator.call({ methodName: 'disconnect' });
    Helper.clearSessions();

    FlowRouter.go('/databaseStats');
  },

  'click #anchorTab1': function () {
    if (!$('#anchorTab1').attr('data-toggle')) {
      toastr.warning('Disable URI connection to use this tab');
    }
  },

  'click #anchorTab2': function () {
    if (!$('#anchorTab2').attr('data-toggle')) {
      toastr.warning('Disable URI connection to use this tab');
    }
  },
});
