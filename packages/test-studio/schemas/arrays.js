import React from 'react'

export default {
  name: 'arraysTest',
  type: 'object',
  title: 'Arrays test',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string'
    },
    {
      name: 'arrayOfPredefinedOptions',
      title: 'Array of predefined options',
      description: (
        <ul>
          <li>It should be possible to check/uncheck the different options.</li>
          <li>There should be a warning about invalid type (number)</li>
          <li>
            When inspecting a document with checked values, the array should contain values with
            <pre>{'{_type: "color", ...}'}</pre>
          </li>
        </ul>
      ),
      type: 'array',
      of: [
        {
          type: 'object',
          name: 'color',
          fields: [
            {
              name: 'title',
              type: 'string',
            },
            {
              name: 'name',
              type: 'string',
            }
          ]
        }
      ],
      options: {
        direction: 'vertical',
        list: [
          {_type: 'color', title: 'Red', name: 'red', _key: 'red'},
          {_type: 'color', title: 'Green', name: 'green', _key: 'green'},
          1, // invalid, not defined in list
          {_type: 'color', title: 'Blue', name: 'blue', _key: 'blue'},
          {_type: 'color', title: 'Black', name: 'black', _key: 'black'},
        ]
      },
    },
    {
      name: 'tags',
      title: 'Tags',
      description: 'Enter a tag and press enter. Should result in an array of strings and should be possible to remove items',
      type: 'array',
      options: {layout: 'tags'},
      of: [{type: 'string'}]
    },
    {
      name: 'arrayWithAnonymousObject',
      title: 'Array with anonymous objects',
      description: 'This array contains objects of type as defined inline',
      type: 'array',
      of: [
        {
          type: 'object',
          title: 'Something',
          fields: [
            {name: 'first', type: 'string', title: 'First string'},
            {name: 'second', type: 'string', title: 'Second string'}
          ]
        }
      ]
    },
    {
      name: 'arrayOfStringsWithLegacyList',
      title: 'Array of strings with legacy format on lists',
      description: 'Previously the `list` option took an array of {title, value} items. It should still be possible to check these values.',
      type: 'array',
      of: [{type: 'string'}],
      options: {
        list: [
          {value: 'residential', title: 'Residential'},
          {value: 'education', title: 'Education'},
          {value: 'commercial', title: 'Commercial'},
          {value: 'cultural', title: 'Cultural'},
          {value: 'display', title: 'Display'},
          {value: 'installation', title: 'Installation'},
          {value: 'objects', title: 'Objects'},
          {value: 'performance', title: 'Performance'},
          {value: 'public space', title: 'Public Space'},
          {value: 'publications', title: 'Publications'}
        ]
      }
    },
    {
      name: 'imageArrayInGrid',
      title: 'Image array',
      description: 'An array of images. options: {layout: "grid"}',
      type: 'array',
      options: {
        layout: 'grid'
      },
      of: [
        {
          name: 'myImage',
          title: 'My Image',
          type: 'myImage'
        }
      ]
    },
    {
      name: 'imageArray',
      title: 'Image array (with defaults)',
      type: 'array',
      of: [
        {
          title: 'Image',
          type: 'image',
          preview: {
            select: {
              imageUrl: 'asset.url',
              title: 'caption'
            }
          },
          fields: [
            {
              name: 'caption',
              type: 'string',
              title: 'Caption',
              options: {
                isHighlighted: true
              }
            }
          ]
        }
      ]
    },
    {
      name: 'imageArrayNotSortable',
      title: 'Image array in grid, *not* sortable',
      description: 'Images here should be append-only',
      type: 'array',
      options: {
        sortable: false,
        layout: 'grid'
      },
      of: [
        {
          title: 'Image',
          type: 'image',
          preview: {
            select: {
              imageUrl: 'asset.url',
              title: 'caption'
            }
          },
          fields: [
            {
              name: 'caption',
              type: 'string',
              title: 'Caption',
              options: {
                isHighlighted: true
              }
            }
          ]
        }
      ]
    },
    {
      name: 'arrayOfNamedReferences',
      type: 'array',
      title: 'Array of named references',
      description: 'The values here should get _type == authorReference or _type == bookReference',
      of: [
        {
          type: 'reference',
          name: 'authorReference',
          to: [{type: 'author', title: 'Reference to author'}]
        },
        {
          type: 'reference',
          name: 'bookReference',
          to: [{type: 'book', title: 'Reference to book'}]
        }
      ]
    }
  ]
}
