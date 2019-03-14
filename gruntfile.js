module.exports = function(grunt) {
  require('load-grunt-tasks')(grunt);

  var PRODUCTION = process.env.NODE_ENV == 'production';

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    browserify: {
      build: {
        files: {
          'build/js/bundle.js': ['src/app.js'],
        },
        options: {
          browserifyOptions: {
            debug: !PRODUCTION,
          },
        },
      },
    },

    sass: {
      dist: {
        files: {
          'build/css/bundle.css': ['src/styles/main.scss'],
        },
        options: {
          style: PRODUCTION ? 'compact' : 'expanded',
          sourcemap: PRODUCTION ? 'none' : 'file',
        },
      },
    },

    jade: {
      compile: {
        options: {
          pretty: !PRODUCTION,
        },
        files: {
          'build/index.html': ['src/views/index.jade'],
        },
      },
    },

    watch: {
      grunt: {
        files: ['Gruntfile.js'],
      },
      jade: {
        files: ['src/views/*.jade'],
        tasks: ['jade'],
      },
      sass: {
        files: ['src/styles/*.scss'],
        tasks: ['sass'],
      },
      browserify: {
        files: ['src/*.js'],
        tasks: ['browserify'],
      },
    },

    copy: {
      assets: {
        expand: true,
        cwd: './src',
        src: ['./assets/*'],
        dest: 'build/',
      },
    },

    uglify: {
      options: {
        manage: false,
      },
      uglify: {
        files: [
          {
            'build/js/bundle.js': ['build/js/bundle.js'],
          },
        ],
      },
    },

    cssmin: {
      minify: {
        files: [
          {
            expand: true,
            cwd: 'build/css/',
            src: '*.css',
            dest: 'build/css',
            ext: '.css',
          },
        ],
      },
    },

    browserSync: {
      bsFiles: {
        src: ['build/*.html'],
      },
      options: {
        watchTask: true,
        server: {
          baseDir: './build',
        },
      },
    },

    clean: {
      build: ['./build/'],
      options: {
        force: true,
      },
    },
  });

  var buildTasks = ['clean', 'copy', 'jade', 'sass', 'browserify', PRODUCTION && 'minimize'].filter(Boolean);

  grunt.registerTask('minimize', ['uglify', 'cssmin']);
  grunt.registerTask('build', buildTasks);
  grunt.registerTask('default', ['build', 'browserSync', 'watch']);
  grunt.task.run('notify_hooks');
};
